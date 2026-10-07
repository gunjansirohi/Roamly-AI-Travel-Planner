```javascript
import { GoogleGenAI } from "@google/genai";
import config from "../config/index.mjs";
import { createFlightProvider } from "../services/flightProvider.mjs";
import {
  databaseReady,
  listFavorites,
  removeFavorite,
  saveRecentSearch,
  setFavorite,
} from "../services/database.mjs";
import { localData } from "../services/localData.mjs";
import { fetchWithRetry, retryOnce } from "../services/providerRequest.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { Trip } from "../models/TravelData.mjs";
import { hotelWebsiteUrl } from "../utils/hotelWebsite.mjs";

const fetch = fetchWithRetry;

// Server-side configuration
const geminiApiKey = String(config.geminiApiKey || "").trim();
const weatherApiKey = String(config.openWeatherApiKey || "").trim();
const googleMapsApiKey = String(config.googleMapsApiKey || "").trim();

const isPlaceholderKey = (value) =>
  /^(your_|replace_|paste_|<)/i.test(value);

const geminiConfigured =
  Boolean(geminiApiKey) && !isPlaceholderKey(geminiApiKey);

const weatherConfigured =
  Boolean(weatherApiKey) && !isPlaceholderKey(weatherApiKey);

const googleMapsConfigured =
  Boolean(googleMapsApiKey) && !isPlaceholderKey(googleMapsApiKey);

const ai = geminiConfigured
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

// Caches
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 30 * 60 * 1000;

const hotelCache = new Map();
const HOTEL_CACHE_TTL = 60 * 60 * 1000;

const restaurantCache = new Map();
const RESTAURANT_CACHE_TTL = 60 * 60 * 1000;

const restaurantDetailCache = new Map();
const RESTAURANT_DETAIL_CACHE_TTL = 60 * 60 * 1000;

const flightCache = new Map();
const FLIGHT_CACHE_TTL = 30 * 60 * 1000;

const itineraryCache = new Map();
const ITINERARY_CACHE_TTL = 24 * 60 * 60 * 1000;

const configuredFlightProvider = createFlightProvider(config);

const flightProvider = {
  async search(search) {
    const result = await configuredFlightProvider.search(search);

    return result.source === "demo"
      ? {
          ...result,
          fallback: true,
          message:
            "Live flight information is temporarily unavailable.",
        }
      : result;
  },
};

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sendError(
  response,
  status,
  message,
  requestId = createRequestId()
) {
  return response.status(status).json({
    success: false,
    itinerary: null,
    error: {
      message,
      requestId,
    },
  });
}

function templateItinerary(prompt) {
  return `# Your travel plan

## Overview
A flexible, practical plan for: ${prompt}

## Day 1 — Arrive and settle in
Check in, take a relaxed walk near your accommodation, and choose a well-reviewed local restaurant.

## Day 2 — Explore the essentials
Visit a major landmark or neighbourhood in the morning, allow time for a local lunch, and keep the evening unstructured.

## Day 3 — Make it your own
Pick one activity that matches your interests, buy any needed tickets in advance, and leave time for travel.

## Budget
Reserve a small contingency for transport, entry tickets, and changes in plans.

## Accommodation
Compare cancellation terms, location, and recent guest reviews before booking.

## Packing and safety
Check the forecast before departure, carry ID and travel documents, and use official transport where possible.`;
}

async function persistGeneratedTrip(request, itinerary) {
  const details = request.body?.trip || {};

  return Trip.create({
    userId: request.user.id,
    destination: String(
      details.destination || "AI generated trip"
    ).trim(),
    startDate: details.startDate || undefined,
    endDate: details.endDate || undefined,
    budget: Number(details.budget) || 0,
    currency: details.currency || "INR",
    itinerary,
    weatherSnapshot: details.weatherSnapshot,
    selectedHotel: details.selectedHotel,
    selectedRestaurant: details.selectedRestaurant,
    selectedFlight: details.selectedFlight,
  });
}

export function registerTravelRoutes(app) {
  // --------------------------------------------------
  // STATUS
  // --------------------------------------------------

  app.get("/status", (_request, response) => {
    const status = (configured, cache) =>
      cache?.size
        ? "Cached"
        : configured
        ? "Online"
        : "Offline";

    response.json({
      success: true,
      Gemini: status(geminiConfigured, itineraryCache),
      Weather: status(weatherConfigured, weatherCache),
      Maps: googleMapsConfigured ? "Online" : "Offline",
      Hotels: status(googleMapsConfigured, hotelCache),
      Restaurants: status(
        googleMapsConfigured,
        restaurantCache
      ),
      Flights: status(
        Boolean(
          config.amadeusClientId &&
            config.amadeusClientSecret
        ),
        flightCache
      ),
    });
  });

  // --------------------------------------------------
  // FAVORITES
  // --------------------------------------------------

  const validUserId = (value) =>
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{8,100}$/.test(value);

  const validFavoriteKind = (value) =>
    value === "hotels" || value === "restaurants";

  app.get(
    "/favorites/:kind",
    requireAuth,
    async (request, response) => {
      const { kind } = request.params;
      const userId = request.user.id;

      if (
        !validFavoriteKind(kind) ||
        !validUserId(userId)
      ) {
        return sendError(
          response,
          400,
          "Enter a valid favorite type and user identifier."
        );
      }

      return response.json({
        success: true,
        favorites: await listFavorites(kind, userId),
        persistent: databaseReady(),
      });
    }
  );

  app.post(
    "/favorites/:kind",
    requireAuth,
    async (request, response) => {
      const { kind } = request.params;
      const { placeId, payload } = request.body || {};
      const userId = request.user.id;

      if (
        !validFavoriteKind(kind) ||
        !validUserId(userId) ||
        typeof placeId !== "string" ||
        !/^[A-Za-z0-9_-]{1,250}$/.test(placeId) ||
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
      ) {
        return sendError(
          response,
          400,
          "Enter valid favorite details."
        );
      }

      const favorite = await setFavorite(
        kind,
        userId,
        placeId,
        payload
      );

      return response.json({
        success: true,
        favorite,
        persistent: databaseReady(),
      });
    }
  );

  app.delete(
    "/favorites/:kind/:placeId",
    requireAuth,
    async (request, response) => {
      const { kind, placeId } = request.params;
      const userId = request.user.id;

      if (
        !validFavoriteKind(kind) ||
        !validUserId(userId) ||
        !/^[A-Za-z0-9_-]{1,250}$/.test(placeId)
      ) {
        return sendError(
          response,
          400,
          "Enter valid favorite details."
        );
      }

      await removeFavorite(
        kind,
        userId,
        placeId
      );

      return response.json({
        success: true,
        persistent: databaseReady(),
      });
    }
  );

  // --------------------------------------------------
  // DESTINATION SEARCH
  // --------------------------------------------------

  app.get(
    "/destinations/search",
    async (request, response) => {
      const requestId = createRequestId();
      const query = String(
        request.query.q || ""
      ).trim();

      if (
        query.length < 3 ||
        query.length > 120
      ) {
        return sendError(
          response,
          400,
          "Enter between 3 and 120 characters to search destinations.",
          requestId
        );
      }

      try {
        const result = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
            query
          )}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "RoamlyTravelPlanner/1.0",
            },
          }
        );

        if (!result.ok) {
          throw Object.assign(
            new Error(
              `Destination provider returned ${result.status}.`
            ),
            { status: result.status }
          );
        }

        const destinations =
          await result.json();

        if (!Array.isArray(destinations)) {
          throw new Error(
            "Destination provider returned an invalid response."
          );
        }

        return response.json({
          success: true,
          destinations,
          fallback: false,
          requestId,
        });
      } catch (error) {
        console.warn(
          `[${requestId}] Destination provider unavailable; using local results.`,
          {
            message:
              error?.message ||
              String(error),
          }
        );

        try {
          const destinations = (
            await localData(
              "popularDestinations"
            )
          )
            .filter(
              (item) =>
                item.name
                  .toLowerCase()
                  .includes(
                    query.toLowerCase()
                  ) ||
                item.country
                  .toLowerCase()
                  .includes(
                    query.toLowerCase()
                  )
            )
            .map((item, index) => ({
              place_id: `local-${index}`,
              name: item.name,
              display_name: `${item.name}, ${item.country}`,
              lat: String(item.latitude),
              lon: String(item.longitude),
              address: {
                country: item.country,
              },
            }));

          return response.json({
            success: true,
            destinations,
            fallback: true,
            message:
              "Live destination search is unavailable; showing verified local results.",
            requestId,
          });
        } catch (fallbackError) {
          console.error(
            `[${requestId}] Destination search failed.`,
            {
              provider:
                error?.message ||
                String(error),
              fallback:
                fallbackError?.message ||
                String(fallbackError),
            }
          );

          return sendError(
            response,
            503,
            "Destination search is unavailable because neither the live provider nor local destination data could be reached.",
            requestId
          );
        }
      }
    }
  );

  // --------------------------------------------------
  // DESTINATION WEATHER
  // --------------------------------------------------

  app.get(
    "/destination-weather",
    async (request, response) => {
      const latitude = Number(
        request.query.latitude
      );
      const longitude = Number(
        request.query.longitude
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      ) {
        return sendError(
          response,
          400,
          "Enter valid destination coordinates."
        );
      }

      try {
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m&timezone=auto`
        );

        if (!result.ok) {
          throw new Error(
            "weather unavailable"
          );
        }

        const data =
          await result.json();

        return response.json({
          success: true,
          weather: {
            temperature: Math.round(
              data.current
                ?.temperature_2m
            ),
            wind: Math.round(
              data.current
                ?.wind_speed_10m
            ),
            timezone: data.timezone,
          },
        });
      } catch (error) {
        console.error(
          "[destination-weather] unavailable",
          error.message
        );

        return response.json({
          success: true,
          weather: null,
          message:
            "Live weather is temporarily unavailable.",
        });
      }
    }
  );

  // --------------------------------------------------
  // HOTEL HELPERS
  // --------------------------------------------------

  const GOOGLE_PLACE_FIELDS =
    "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.types,places.editorialSummary";

  const GOOGLE_DETAIL_FIELDS =
    "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,regularOpeningHours,websiteUri,nationalPhoneNumber,googleMapsUri,types,editorialSummary,reviews,parkingOptions,accessibilityOptions,paymentOptions";

  function haversineDistance(
    from,
    to
  ) {
    const radians = (number) =>
      (number * Math.PI) / 180;

    const earthRadiusKm = 6371;

    const deltaLat = radians(
      to.latitude - from.latitude
    );

    const deltaLng = radians(
      to.longitude - from.longitude
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(
        radians(from.latitude)
      ) *
        Math.cos(
          radians(to.latitude)
        ) *
        Math.sin(deltaLng / 2) ** 2;

    return Math.round(
      earthRadiusKm *
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        ) *
        10
    ) / 10;
  }

  function hotelCategory(place) {
    const types = place.types || [];
    const name =
      place.displayName?.text || "";

    if (
      types.includes("resort_hotel") ||
      /resort|retreat/i.test(name)
    ) {
      return "Resort";
    }

    if (
      /business|conference/i.test(
        name
      )
    ) {
      return "Business";
    }

    if (
      place.priceLevel ===
        "PRICE_LEVEL_VERY_EXPENSIVE" ||
      place.priceLevel ===
        "PRICE_LEVEL_EXPENSIVE"
    ) {
      return "Luxury";
    }

    if (
      place.priceLevel ===
        "PRICE_LEVEL_FREE" ||
      place.priceLevel ===
        "PRICE_LEVEL_INEXPENSIVE"
    ) {
      return "Budget";
    }

    return "Family";
  }

  function hotelCommerce(
    priceLevel,
    seed = 0
  ) {
    const base = {
      PRICE_LEVEL_FREE: 55,
      PRICE_LEVEL_INEXPENSIVE: 78,
      PRICE_LEVEL_MODERATE: 130,
      PRICE_LEVEL_EXPENSIVE: 235,
      PRICE_LEVEL_VERY_EXPENSIVE: 420,
      PRICE_LEVEL_UNSPECIFIED: 145,
    }[priceLevel] || 145;

    return {
      nightlyRate:
        base + (seed % 5) * 9,
      currency: "USD",
      discountPercent:
        seed % 3 === 0 ? 15 : 0,
      cancellationPolicy:
        "Free cancellation until 48 hours before check-in",
      availability:
        "Limited availability",
    };
  }

  function publicHotel(
    place,
    cityCenter
  ) {
    const location =
      place.location || {};

    const name =
      place.displayName?.text ||
      "Hotel";

    const city =
      cityCenter?.name ||
      place.formattedAddress ||
      "";

    return {
      id: place.id,
      name,
      address:
        place.formattedAddress ||
        "Address unavailable",
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      rating: Number(place.rating) || 0,
      reviewCount:
        Number(
          place.userRatingCount
        ) || 0,
      priceLevel:
        place.priceLevel ||
        "PRICE_LEVEL_UNSPECIFIED",
      openNow:
        place.regularOpeningHours
          ?.openNow ?? null,
      category:
        hotelCategory(place),
      distanceKm:
        Number.isFinite(
          location.latitude
        ) &&
        Number.isFinite(
          location.longitude
        ) &&
        cityCenter
          ? haversineDistance(
              cityCenter,
              location
            )
          : null,
      mapsUrl:
        place.googleMapsUri || "",
      website: hotelWebsiteUrl(
        place.websiteUri,
        name,
        city
      ),
      phone:
        place.nationalPhoneNumber ||
        "",
      ...hotelCommerce(
        place.priceLevel,
        Number(
          place.userRatingCount
        ) || 0
      ),
    };
  }

  // --------------------------------------------------
  // MOCK HOTELS
  // --------------------------------------------------

  async function fetchMockHotels(
    city,
    requestId
  ) {
    console.info(
      `[${requestId}] Generating mock hotel recommendations fallback for: ${city}`
    );

    let cityCenter = {
      latitude: 48.8566,
      longitude: 2.3522,
      name: city,
    };

    try {
      const geoUrl =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          city
        )}`;

      const geoResponse =
        await fetch(geoUrl, {
          headers: {
            "User-Agent":
              "RoamlyTravelPlanner/1.0",
          },
        });

      if (geoResponse.ok) {
        const geoData =
          await geoResponse.json();

        const location =
          geoData?.[0];

        if (location) {
          cityCenter = {
            latitude: parseFloat(
              location.lat
            ),
            longitude: parseFloat(
              location.lon
            ),
            name:
              location.display_name,
          };
        }
      }
    } catch (err) {
      console.warn(
        `[${requestId}] Nominatim geocoding failed for mock hotels, using default coordinates`,
        err
      );
    }

    const mockHotelTemplates = [
      {
        name: "Grand Plaza Hotel",
        category: "Luxury",
        priceLevel:
          "PRICE_LEVEL_EXPENSIVE",
        rating: 4.8,
        reviewCount: 1240,
      },
      {
        name: "Riverside Boutique Stay",
        category: "Resort",
        priceLevel:
          "PRICE_LEVEL_MODERATE",
        rating: 4.6,
        reviewCount: 840,
      },
      {
        name: "Urban Backpackers",
        category: "Budget",
        priceLevel:
          "PRICE_LEVEL_INEXPENSIVE",
        rating: 4.2,
        reviewCount: 420,
      },
      {
        name: "Metropolitan Business Hotel",
        category: "Business",
        priceLevel:
          "PRICE_LEVEL_MODERATE",
        rating: 4.5,
        reviewCount: 650,
      },
      {
        name: "Cozy Family Retreat",
        category: "Family",
        priceLevel:
          "PRICE_LEVEL_MODERATE",
        rating: 4.4,
        reviewCount: 310,
      },
    ];

    const savedTemplates =
      await localData("hotels");

    const templates = savedTemplates.length
      ? savedTemplates
      : mockHotelTemplates;

    const hotels = templates.map(
      (template, idx) => {
        const latOffset =
          Math.sin(idx) * 0.015;

        const lngOffset =
          Math.cos(idx) * 0.015;

        const hotelLat =
          cityCenter.latitude +
          latOffset;

        const hotelLng =
          cityCenter.longitude +
          lngOffset;

        const normalizedCity =
          city.charAt(0).toUpperCase() +
          city.slice(1);

        return {
          id: `mock-hotel-${idx}-${city
            .toLowerCase()
            .replace(
              /[^a-z0-9]/g,
              ""
            )}`,
          name: `${normalizedCity} ${template.name}`,
          address: `10${idx} Promenade Street, ${normalizedCity}`,
          coordinates: {
            latitude: hotelLat,
            longitude: hotelLng,
          },
          rating: template.rating,
          reviewCount:
            template.reviewCount,
          priceLevel:
            template.priceLevel,
          openNow: true,
          category: template.category,
          distanceKm: Math.round(
            haversineDistance(
              cityCenter,
              {
                latitude: hotelLat,
                longitude: hotelLng,
              }
            ) * 10
          ) / 10,
          mapsUrl:
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              normalizedCity +
                " " +
                template.name
            )}`,
          website: hotelWebsiteUrl(
            "",
            `${normalizedCity} ${template.name}`,
            normalizedCity
          ),
          phone: "+1 555-0199",
          ...hotelCommerce(
            template.priceLevel,
            idx
          ),
        };
      }
    );

    return {
      hotels,
      cityCenter,
    };
  }

  // --------------------------------------------------
  // HOTELS
  // --------------------------------------------------

  app.get(
    "/hotels",
    async (request, response) => {
      const requestId =
        createRequestId();

      const city =
        typeof request.query.city ===
        "string"
          ? request.query.city.trim()
          : "";

      if (
        !city ||
        city.length > 120
      ) {
        return sendError(
          response,
          400,
          "Enter a valid destination to find hotels.",
          requestId
        );
      }

      void saveRecentSearch({
        query: city,
        category: "hotels",
      });

      const cacheKey =
        city.toLowerCase();

      const cached =
        hotelCache.get(cacheKey);

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          HOTEL_CACHE_TTL
      ) {
        return response.json({
          success: true,
          hotels: cached.hotels,
          cityCenter:
            cached.cityCenter,
          cached: true,
        });
      }

      if (googleMapsConfigured) {
        try {
          const geocodeUrl =
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
              city
            )}&key=${googleMapsApiKey}`;

          const geocodeResponse =
            await fetch(geocodeUrl);

          const geocode =
            await geocodeResponse
              .json()
              .catch(() => null);

          if (
            !geocodeResponse.ok ||
            geocode?.status ===
              "REQUEST_DENIED"
          ) {
            throw new Error(
              "City geocoding failed"
            );
          }

          const result =
            geocode?.results?.[0];

          if (
            !result?.geometry?.location
          ) {
            return sendError(
              response,
              404,
              `No location was found for "${city}".`,
              requestId
            );
          }

          const cityCenter = {
            latitude:
              result.geometry.location
                .lat,
            longitude:
              result.geometry.location
                .lng,
            name:
              result.formatted_address,
          };

          const placesResponse =
            await fetch(
              "https://places.googleapis.com/v1/places:searchText",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  "X-Goog-Api-Key":
                    googleMapsApiKey,
                  "X-Goog-FieldMask":
                    GOOGLE_PLACE_FIELDS,
                },
                body: JSON.stringify({
                  textQuery: `hotels in ${city}`,
                  includedType:
                    "lodging",
                  maxResultCount: 20,
                  languageCode: "en",
                  locationBias: {
                    circle: {
                      center: {
                        latitude:
                          cityCenter.latitude,
                        longitude:
                          cityCenter.longitude,
                      },
                      radius: 15000,
                    },
                  },
                }),
              }
            );

          const places =
            await placesResponse
              .json()
              .catch(() => null);

          if (!placesResponse.ok) {
            throw new Error(
              "Hotel search failed"
            );
          }

          const hotels = (
            places?.places || []
          )
            .map((place) =>
              publicHotel(
                place,
                cityCenter
              )
            )
            .filter(
              (hotel) =>
                hotel.id &&
                Number.isFinite(
                  hotel.coordinates
                    .latitude
                )
            );

          hotelCache.set(
            cacheKey,
            {
              hotels,
              cityCenter,
              savedAt: Date.now(),
            }
          );

          return response.json({
            success: true,
            hotels,
            cityCenter,
            cached: false,
          });
        } catch (error) {
          console.warn(
            `[${requestId}] Google hotel search failed; using fallback.`,
            error?.message
          );
        }
      }

      try {
        const {
          hotels,
          cityCenter,
        } = await fetchMockHotels(
          city,
          requestId
        );

        hotelCache.set(
          cacheKey,
          {
            hotels,
            cityCenter,
            savedAt: Date.now(),
          }
        );

        return response.json({
          success: true,
          hotels,
          cityCenter,
          cached: false,
        });
      } catch (fallbackError) {
        console.error(
          `[${requestId}] Hotel fallback failed`,
          fallbackError
        );

        return sendError(
          response,
          502,
          "Hotel recommendations are temporarily unavailable. Please try again.",
          requestId
        );
      }
    }
  );

  // --------------------------------------------------
  // HOTEL DETAILS
  // --------------------------------------------------

  app.get(
    "/hotels/:placeId",
    async (request, response) => {
      const requestId =
        createRequestId();

      const placeId = String(
        request.params.placeId || ""
      ).trim();

      if (
        !/^[A-Za-z0-9_-]{5,250}$/.test(
          placeId
        )
      ) {
        return sendError(
          response,
          400,
          "Invalid hotel identifier.",
          requestId
        );
      }

      if (
        placeId.startsWith(
          "mock-hotel-"
        )
      ) {
        return response.json({
          success: true,
          hotel: {
            id: placeId,
            name: "Local Hotel",
            address:
              "Address unavailable",
            coordinates: {
              latitude: 0,
              longitude: 0,
            },
            rating: 4.5,
            reviewCount: 150,
            priceLevel:
              "PRICE_LEVEL_MODERATE",
            openNow: true,
            category: "Family",
            distanceKm: 1.5,
            mapsUrl: "",
            website: "",
            phone: "",
          },
          details: {
            description:
              "Detailed hotel information is temporarily unavailable.",
            openingHours: [],
            reviews: [],
            amenities: ["Free Wi-Fi"],
          },
        });
      }

      if (googleMapsConfigured) {
        try {
          const detailResponse =
            await fetch(
              `https://places.googleapis.com/v1/places/${encodeURIComponent(
                placeId
              )}?languageCode=en`,
              {
                headers: {
                  "X-Goog-Api-Key":
                    googleMapsApiKey,
                  "X-Goog-FieldMask":
                    GOOGLE_DETAIL_FIELDS,
                },
              }
            );

          const detail =
            await detailResponse
              .json()
              .catch(() => null);

          if (!detailResponse.ok) {
            throw new Error(
              "Hotel detail failed"
            );
          }

          return response.json({
            success: true,
            hotel: publicHotel(
              detail,
              detail.location
            ),
            details: {
              description:
                detail
                  .editorialSummary
                  ?.text ||
                "No hotel description is available.",
              openingHours:
                detail
                  .regularOpeningHours
                  ?.weekdayDescriptions ||
                [],
              reviews:
                detail.reviews || [],
              amenities: [
                detail
                  .parkingOptions
                  ?.freeParking
                  ? "Free parking"
                  : "",
                detail
                  .parkingOptions
                  ?.valetParking
                  ? "Valet parking"
                  : "",
                detail
                  .accessibilityOptions
                  ?.wheelchairAccessibleEntrance
                  ? "Accessible entrance"
                  : "",
              ].filter(Boolean),
            },
          });
        } catch (error) {
          console.warn(
            `[${requestId}] Hotel detail failed`,
            error?.message
          );
        }
      }

      return response.json({
        success: true,
        hotel: {
          id: placeId,
          name: "Local Hotel",
          address:
            "Address unavailable",
          coordinates: {
            latitude: 0,
            longitude: 0,
          },
          rating: 4.5,
          reviewCount: 150,
          priceLevel:
            "PRICE_LEVEL_MODERATE",
          openNow: null,
          category: "Family",
          distanceKm: null,
          mapsUrl: "",
          website: "",
          phone: "",
        },
        details: {
          description:
            "Detailed description is temporarily unavailable for this hotel.",
          openingHours: [
            "Hours unavailable",
          ],
          reviews: [],
          amenities: ["Free Wi-Fi"],
        },
      });
    }
  );

  // --------------------------------------------------
  // RESTAURANTS
  // --------------------------------------------------

  const RESTAURANT_FIELDS =
    "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.types,places.editorialSummary";

  const RESTAURANT_DETAIL_FIELDS =
    `${RESTAURANT_FIELDS},reviews,parkingOptions,accessibilityOptions,outdoorSeating,servesVegetarianFood,goodForChildren`;

  const GOOGLE_GEOCODE_ENDPOINT =
    "https://maps.googleapis.com/maps/api/geocode/json";

  const GOOGLE_TEXT_SEARCH_ENDPOINT =
    "https://places.googleapis.com/v1/places:searchText";

  function providerReason(payload) {
    const error =
      payload?.error || payload;

    return (
      error?.message ||
      payload?.error_message ||
      error?.status ||
      payload?.status ||
      "Google did not provide a reason."
    );
  }

  async function googleRestaurantJson(
    requestId,
    label,
    url,
    options = {}
  ) {
    const safeUrl =
      url.replace(
        googleMapsApiKey,
        "[REDACTED]"
      );

    let result;

    try {
      result = await fetch(
        url,
        options
      );
    } catch (cause) {
      throw Object.assign(
        cause instanceof Error
          ? cause
          : new Error(
              "Google request failed"
            ),
        {
          url: safeUrl,
        }
      );
    }

    const payload =
      await result.json()
        .catch(() => null);

    if (
      !result.ok ||
      payload?.status ===
        "REQUEST_DENIED" ||
      payload?.error
    ) {
      throw Object.assign(
        new Error(
          providerReason(payload)
        ),
        {
          status: result.status,
          body: payload,
          url: safeUrl,
        }
      );
    }

    return payload;
  }

  function restaurantCategories(
    place
  ) {
    const text =
      `${place.displayName?.text || ""} ${(
        place.types || []
      ).join(" ")}`.toLowerCase();

    const categories = [];

    if (/indian/.test(text))
      categories.push("Indian");

    if (/chinese/.test(text))
      categories.push("Chinese");

    if (/italian|pizza/.test(text))
      categories.push("Italian");

    if (
      /fine_dining|fine dining|michelin/.test(
        text
      )
    )
      categories.push("Fine Dining");

    if (/vegetarian|vegan/.test(text))
      categories.push("Vegetarian");

    if (
      /cafe|coffee_shop|coffee/.test(
        text
      )
    )
      categories.push("Cafe");

    if (/bakery/.test(text))
      categories.push("Bakery");

    if (
      /fast_food|street_food|food_stall|food_court|hamburger|sandwich/.test(
        text
      )
    )
      categories.push("Fast Food");

    if (
      /restaurant|meal_takeaway|meal_delivery|barbecue|pizza|sushi|indian|chinese|italian/.test(
        text
      )
    )
      categories.push("Restaurant");

    return categories.length
      ? [...new Set(categories)]
      : ["Restaurant"];
  }

  function publicRestaurant(
    place,
    cityCenter
  ) {
    const location =
      place.location || {};

    const categories =
      restaurantCategories(place);

    return {
      id: place.id,
      name:
        place.displayName?.text ||
        "Place",
      address:
        place.formattedAddress ||
        "Address unavailable",
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      rating:
        Number(place.rating) || 0,
      reviewCount:
        Number(
          place.userRatingCount
        ) || 0,
      priceLevel:
        place.priceLevel ||
        "PRICE_LEVEL_UNSPECIFIED",
      openNow:
        place.regularOpeningHours
          ?.openNow ?? null,
      category: categories[0],
      categories,
      distanceKm:
        Number.isFinite(
          location.latitude
        ) &&
        Number.isFinite(
          location.longitude
        ) &&
        cityCenter
          ? haversineDistance(
              cityCenter,
              location
            )
          : null,
      mapsUrl:
        place.googleMapsUri ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          place.displayName?.text ||
            "place"
        )}`,
      website:
        place.websiteUri || "",
      phone:
        place.nationalPhoneNumber ||
        "",
    };
  }

  app.get(
    "/restaurants",
    async (request, response) => {
      const requestId =
        createRequestId();

      const city =
        typeof request.query.city ===
        "string"
          ? request.query.city.trim()
          : "";

      if (
        !city ||
        city.length > 120
      ) {
        return sendError(
          response,
          400,
          "Enter a valid destination to find restaurants.",
          requestId
        );
      }

      void saveRecentSearch({
        query: city,
        category: "restaurants",
      });

      const cacheKey =
        city.toLowerCase();

      const cached =
        restaurantCache.get(cacheKey);

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          RESTAURANT_CACHE_TTL
      ) {
        return response.json({
          success: true,
          restaurants:
            cached.restaurants,
          cityCenter:
            cached.cityCenter,
          cached: true,
        });
      }

      try {
        if (!googleMapsConfigured) {
          throw new Error(
            "Google Maps is unavailable"
          );
        }

        const geocodeUrl =
          `${GOOGLE_GEOCODE_ENDPOINT}?address=${encodeURIComponent(
            city
          )}&key=${encodeURIComponent(
            googleMapsApiKey
          )}`;

        const geocode =
          await googleRestaurantJson(
            requestId,
            "Geocoding API",
            geocodeUrl
          );

        const location =
          geocode?.results?.[0]
            ?.geometry?.location;

        if (!location) {
          return sendError(
            response,
            404,
            `Google could not find a destination matching "${city}".`,
            requestId
          );
        }

        const cityCenter = {
          latitude: location.lat,
          longitude: location.lng,
          name:
            geocode.results[0]
              .formatted_address,
        };

        const searches = [
          "restaurants",
          "Indian restaurants",
          "Chinese restaurants",
          "Italian restaurants",
          "fast food restaurants",
          "cafes",
          "bakeries",
          "vegetarian restaurants",
          "fine dining restaurants",
        ];

        const responses =
          await Promise.all(
            searches.map(
              async (query) => {
                const body =
                  JSON.stringify({
                    textQuery: `${query} in ${city}`,
                    maxResultCount: 20,
                    languageCode: "en",
                    locationBias: {
                      circle: {
                        center: {
                          latitude:
                            cityCenter.latitude,
                          longitude:
                            cityCenter.longitude,
                        },
                        radius: 15000,
                      },
                    },
                  });

                const payload =
                  await googleRestaurantJson(
                    requestId,
                    `Places API text search: ${query}`,
                    GOOGLE_TEXT_SEARCH_ENDPOINT,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                        "X-Goog-Api-Key":
                          googleMapsApiKey,
                        "X-Goog-FieldMask":
                          RESTAURANT_FIELDS,
                      },
                      body,
                    }
                  );

                return (
                  payload?.places || []
                );
              }
            )
          );

        const seen = new Set();

        const places = responses
          .flat()
          .filter(
            (place) =>
              place.id &&
              !seen.has(place.id) &&
              seen.add(place.id)
          );

        const restaurants =
          places
            .map((place) =>
              publicRestaurant(
                place,
                cityCenter
              )
            )
            .filter(
              (item) => item.id
            )
            .slice(0, 30);

        const data = {
          restaurants,
          cityCenter,
          savedAt: Date.now(),
        };

        restaurantCache.set(
          cacheKey,
          data
        );

        return response.json({
          success: true,
          restaurants,
          cityCenter,
          cached: false,
        });
      } catch (error) {
        console.error(
          `[${requestId}] Restaurant provider failed; using local dataset.`,
          error?.message
        );

        const restaurants = (
          await localData(
            "restaurants"
          )
        ).map((item) => ({
          ...item,
          mapsUrl:
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${item.name} ${city}`
            )}`,
          website: "",
          phone: "",
          coordinates: {
            latitude: 0,
            longitude: 0,
          },
        }));

        const data = {
          restaurants,
          cityCenter: null,
          savedAt: Date.now(),
        };

        restaurantCache.set(
          cacheKey,
          data
        );

        return response.json({
          success: true,
          ...data,
          fallback: true,
          message:
            "Live restaurant information is temporarily unavailable.",
        });
      }
    }
  );

  app.get(
    "/restaurants/:placeId",
    async (request, response) => {
      const placeId = String(
        request.params.placeId || ""
      ).trim();

      if (
        !/^[A-Za-z0-9_-]{5,250}$/.test(
          placeId
        )
      ) {
        return sendError(
          response,
          400,
          "Invalid restaurant identifier."
        );
      }

      const cached =
        restaurantDetailCache.get(
          placeId
        );

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          RESTAURANT_DETAIL_CACHE_TTL
      ) {
        return response.json({
          success: true,
          details: cached.details,
          cached: true,
        });
      }

      if (
        placeId.startsWith(
          "mock-restaurant-"
        )
      ) {
        return response.json({
          success: true,
          details: {
            description:
              "A popular local dining choice selected for its strong guest ratings and convenient city-centre location.",
            openingHours: [],
            amenities: [
              "Wi-Fi",
              "Parking",
              "Outdoor seating",
              "Takeaway",
            ],
            reviews: [],
          },
        });
      }

      try {
        if (!googleMapsConfigured) {
          throw new Error(
            "Google Maps unavailable"
          );
        }

        const result =
          await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(
              placeId
            )}?languageCode=en`,
            {
              headers: {
                "X-Goog-Api-Key":
                  googleMapsApiKey,
                "X-Goog-FieldMask":
                  RESTAURANT_DETAIL_FIELDS,
              },
            }
          );

        const place =
          await result.json()
            .catch(() => null);

        if (!result.ok) {
          throw new Error(
            "Restaurant details failed"
          );
        }

        const amenities = [
          place.outdoorSeating
            ? "Outdoor seating"
            : "",
          place.servesVegetarianFood
            ? "Vegetarian options"
            : "",
          place.goodForChildren
            ? "Good for children"
            : "",
          place.parkingOptions
            ?.freeParking
            ? "Free parking"
            : "",
          place.accessibilityOptions
            ?.wheelchairAccessibleEntrance
            ? "Accessible entrance"
            : "",
        ].filter(Boolean);

        const details = {
          description:
            place
              .editorialSummary
              ?.text ||
            "No restaurant description is available.",
          openingHours:
            place
              .regularOpeningHours
              ?.weekdayDescriptions ||
            [],
          amenities,
          reviews:
            place.reviews || [],
        };

        restaurantDetailCache.set(
          placeId,
          {
            details,
            savedAt: Date.now(),
          }
        );

        return response.json({
          success: true,
          details,
        });
      } catch {
        return response.json({
          success: true,
          details: {
            description:
              "Detailed information is temporarily unavailable.",
            openingHours: [],
            amenities: [],
            reviews: [],
          },
        });
      }
    }
  );

  // --------------------------------------------------
  // FLIGHTS
  // --------------------------------------------------

  app.get(
    "/flights",
    async (request, response) => {
      const departure =
        typeof request.query
          .departure === "string"
          ? request.query.departure.trim()
          : "";

      const destination =
        typeof request.query
          .destination === "string"
          ? request.query.destination.trim()
          : "";

      const departureDate =
        typeof request.query
          .departureDate === "string"
          ? request.query.departureDate
          : "";

      const returnDate =
        typeof request.query
          .returnDate === "string"
          ? request.query.returnDate
          : "";

      const travelers = Number(
        request.query.travelers || 1
      );

      const datePattern =
        /^\d{4}-\d{2}-\d{2}$/;

      if (
        departure.length < 2 ||
        destination.length < 2 ||
        !datePattern.test(
          departureDate
        ) ||
        (returnDate &&
          !datePattern.test(
            returnDate
          )) ||
        !Number.isInteger(
          travelers
        ) ||
        travelers < 1 ||
        travelers > 9
      ) {
        return sendError(
          response,
          400,
          "Enter valid departure and destination cities, travel date, and 1–9 travelers."
        );
      }

      if (
        departure.toLowerCase() ===
        destination.toLowerCase()
      ) {
        return sendError(
          response,
          400,
          "Departure and destination cities must be different."
        );
      }

      if (
        returnDate &&
        returnDate < departureDate
      ) {
        return sendError(
          response,
          400,
          "Return date must be after the departure date."
        );
      }

      const search = {
        departure,
        destination,
        departureDate,
        returnDate,
        travelers,
      };

      void saveRecentSearch({
        query: `${departure} to ${destination}`,
        category: "flights",
      });

      const key =
        JSON.stringify(search);

      const cached =
        flightCache.get(key);

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          FLIGHT_CACHE_TTL
      ) {
        return response.json({
          success: true,
          flights: cached.flights,
          source: cached.source,
          fallback: cached.fallback,
          message: cached.message,
          cached: true,
        });
      }

      try {
        const result =
          await flightProvider.search(
            search
          );

        flightCache.set(key, {
          ...result,
          savedAt: Date.now(),
        });

        return response.json({
          success: true,
          ...result,
          cached: false,
        });
      } catch (error) {
        console.error(
          "Flight search failed; using sample recommendations",
          error?.message
        );

        const flights = (
          await localData("flights")
        ).map(
          (item, index) => ({
            ...item,
            id: `${item.id}-${index}`,
            departure: {
              airport:
                departure
                  .slice(0, 3)
                  .toUpperCase(),
              time: `${departureDate}T09:00:00`,
            },
            arrival: {
              airport:
                destination
                  .slice(0, 3)
                  .toUpperCase(),
              time: `${departureDate}T11:15:00`,
            },
            bookingUrl:
              `https://www.google.com/travel/flights?q=${encodeURIComponent(
                `${departure} to ${destination}`
              )}`,
          })
        );

        return response.json({
          success: true,
          flights,
          source: "fallback",
          fallback: true,
          message:
            "Live flight information is temporarily unavailable.",
        });
      }
    }
  );

  // --------------------------------------------------
  // WEATHER
  // --------------------------------------------------

  async function fetchFallbackWeather(
    city,
    requestId
  ) {
    const geoUrl =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        city
      )}`;

    const geoResponse =
      await fetch(geoUrl, {
        headers: {
          "User-Agent":
            "RoamlyTravelPlanner/1.0",
        },
      });

    if (!geoResponse.ok) {
      throw new Error(
        "OSM Geocoding failed"
      );
    }

    const geoData =
      await geoResponse.json();

    const location =
      geoData?.[0];

    if (!location) {
      throw new Error(
        "City not found"
      );
    }

    const lat = parseFloat(
      location.lat
    );

    const lon = parseFloat(
      location.lon
    );

    const displayNameParts =
      location.display_name.split(
        ","
      );

    const name =
      displayNameParts[0].trim();

    const country =
      displayNameParts[
        displayNameParts.length - 1
      ].trim();

    const state =
      displayNameParts.length > 2
        ? displayNameParts[
            displayNameParts.length - 2
          ].trim()
        : "";

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl,wind_speed_10m,weather_code,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;

    const forecastResponse =
      await fetch(forecastUrl);

    if (!forecastResponse.ok) {
      throw new Error(
        "Open-Meteo forecast failed"
      );
    }

    const forecastData =
      await forecastResponse.json();

    const mapWmoToOwmId = (
      code
    ) => {
      const mappings = {
        0: 800,
        1: 801,
        2: 802,
        3: 803,
        45: 741,
        48: 741,
        51: 300,
        53: 301,
        55: 302,
        56: 310,
        57: 311,
        61: 500,
        63: 501,
        65: 502,
        66: 511,
        67: 511,
        71: 600,
        73: 601,
        75: 602,
        77: 611,
        80: 520,
        81: 521,
        82: 522,
        85: 620,
        86: 621,
        95: 200,
        96: 210,
        99: 212,
      };

      return (
        mappings[code] || 800
      );
    };

    const getWmoDescription = (
      code
    ) => {
      const descriptions = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "foggy",
        48: "depositing rime fog",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "dense drizzle",
        56: "light freezing drizzle",
        57: "dense freezing drizzle",
        61: "slight rain",
        63: "moderate rain",
        65: "heavy rain",
        66: "light freezing rain",
        67: "heavy freezing rain",
        71: "slight snow fall",
        73: "moderate snow fall",
        75: "heavy snow fall",
        77: "snow grains",
        80: "slight rain showers",
        81: "moderate rain showers",
        82: "violent rain showers",
        85: "slight snow showers",
        86: "heavy snow showers",
        95: "thunderstorm",
        96: "thunderstorm with slight hail",
        99: "thunderstorm with heavy hail",
      };

      return (
        descriptions[code] ||
        "clear sky"
      );
    };

    const toUnix = (
      isoStr
    ) =>
      Math.floor(
        new Date(
          isoStr
        ).getTime() / 1000
      );

    const current = {
      temp:
        forecastData.current
          .temperature_2m,
      feels_like:
        forecastData.current
          .apparent_temperature,
      humidity:
        forecastData.current
          .relative_humidity_2m,
      wind_speed:
        forecastData.current
          .wind_speed_10m / 3.6,
      visibility: 10000,
      pressure:
        forecastData.current
          .pressure_msl,
      uvi:
        forecastData.current
          .uv_index || 0,
      sunrise: toUnix(
        forecastData.daily
          .sunrise[0]
      ),
      sunset: toUnix(
        forecastData.daily
          .sunset[0]
      ),
      weather: [
        {
          id: mapWmoToOwmId(
            forecastData.current
              .weather_code
          ),
          description:
            getWmoDescription(
              forecastData.current
                .weather_code
            ),
        },
      ],
    };

    const hourly = [];

    const nowUnix = Math.floor(
      Date.now() / 1000
    );

    const hourlyTimes =
      forecastData.hourly.time;

    for (
      let i = 0;
      i < hourlyTimes.length;
      i++
    ) {
      const dt = toUnix(
        hourlyTimes[i]
      );

      if (
        dt >= nowUnix - 3600
      ) {
        hourly.push({
          dt,
          temp:
            forecastData.hourly
              .temperature_2m[i],
          pop:
            (forecastData.hourly
              .precipitation_probability[
              i
            ] || 0) / 100,
          weather: [
            {
              id: mapWmoToOwmId(
                forecastData.hourly
                  .weather_code[i]
              ),
            },
          ],
        });
      }
    }

    const daily = [];

    const dailyTimes =
      forecastData.daily.time;

    for (
      let i = 0;
      i < dailyTimes.length;
      i++
    ) {
      daily.push({
        dt: toUnix(
          dailyTimes[i] +
            "T12:00:00"
        ),
        temp: {
          max:
            forecastData.daily
              .temperature_2m_max[i],
          min:
            forecastData.daily
              .temperature_2m_min[i],
        },
        pop:
          (forecastData.daily
            .precipitation_probability_max[
            i
          ] || 0) / 100,
        weather: [
          {
            id: mapWmoToOwmId(
              forecastData.daily
                .weather_code[i]
            ),
          },
        ],
      });
    }

    console.info(
      `[${requestId}] Open-Meteo fallback weather generated`
    );

    return {
      location: {
        name,
        country,
        state,
      },
      current,
      hourly,
      daily,
      timezoneOffset:
        forecastData.utc_offset_seconds ||
        0,
    };
  }

  app.get(
    "/weather",
    async (request, response) => {
      const requestId =
        createRequestId();

      const city =
        typeof request.query.city ===
        "string"
          ? request.query.city.trim()
          : "";

      if (
        !city ||
        city.length > 120
      ) {
        return sendError(
          response,
          400,
          "Enter a valid city name.",
          requestId
        );
      }

      const cacheKey =
        city.toLowerCase();

      const cached =
        weatherCache.get(cacheKey);

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          WEATHER_CACHE_TTL
      ) {
        return response.json({
          success: true,
          weather: cached.weather,
          cached: true,
        });
      }

      if (weatherConfigured) {
        try {
          const geoUrl =
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
              city
            )}&limit=1&appid=${weatherApiKey}`;

          const geoResponse =
            await fetch(geoUrl);

          const geoBody =
            await geoResponse
              .json()
              .catch(() => null);

          if (!geoResponse.ok) {
            throw new Error(
              "OpenWeather geocoding failed"
            );
          }

          const [location] =
            Array.isArray(
              geoBody
            )
              ? geoBody
              : [];

          if (!location) {
            return sendError(
              response,
              404,
              "We couldn't find that city. Check the spelling and try again.",
              requestId
            );
          }

          const forecastUrl =
            `https://api.openweathermap.org/data/3.0/onecall?lat=${location.lat}&lon=${location.lon}&units=metric&exclude=minutely,alerts&appid=${weatherApiKey}`;

          const forecastResponse =
            await fetch(
              forecastUrl
            );

          const forecast =
            await forecastResponse
              .json()
              .catch(() => null);

          if (!forecastResponse.ok) {
            throw new Error(
              "OpenWeather forecast failed"
            );
          }

          if (
            !forecast?.current ||
            !Array.isArray(
              forecast.hourly
            ) ||
            !Array.isArray(
              forecast.daily
            )
          ) {
            throw new Error(
              "OpenWeather returned incomplete forecast data"
            );
          }

          const weather = {
            location: {
              name: location.name,
              country:
                location.country,
              state:
                location.state,
            },
            current:
              forecast.current,
            hourly:
              forecast.hourly,
            daily:
              forecast.daily,
            timezoneOffset:
              forecast.timezone_offset ||
              0,
          };

          weatherCache.set(
            cacheKey,
            {
              weather,
              savedAt: Date.now(),
            }
          );

          return response.json({
            success: true,
            weather,
            cached: false,
          });
        } catch (error) {
          console.warn(
            `[${requestId}] OpenWeather failed; using Open-Meteo fallback.`,
            error?.message
          );
        }
      }

      try {
        const weather =
          await fetchFallbackWeather(
            city,
            requestId
          );

        weatherCache.set(
          cacheKey,
          {
            weather,
            savedAt: Date.now(),
          }
        );

        return response.json({
          success: true,
          weather,
          cached: false,
        });
      } catch (fallbackError) {
        console.error(
          `[${requestId}] Weather fallback failed`,
          fallbackError
        );

        if (cached?.weather) {
          return response.json({
            success: true,
            weather:
              cached.weather,
            cached: true,
            stale: true,
          });
        }

        return sendError(
          response,
          502,
          "Live weather is temporarily unavailable.",
          requestId
        );
      }
    }
  );

  // --------------------------------------------------
  // AI TRIP
  // --------------------------------------------------

  app.post(
    "/ai-trip",
    requireAuth,
    async (request, response) => {
      const requestId =
        createRequestId();

      const prompt =
        typeof request.body?.prompt ===
        "string"
          ? request.body.prompt.trim()
          : "";

      const language =
        typeof request.body
          ?.language === "string" &&
        /^[a-z]{2}$/i.test(
          request.body.language
        )
          ? request.body.language.toLowerCase()
          : "en";

      if (
        !prompt ||
        prompt.length > 1500
      ) {
        return sendError(
          response,
          400,
          "Provide a trip request between 1 and 1,500 characters.",
          requestId
        );
      }

      const cacheKey = `${language}:${prompt.toLowerCase()}`;

      const cached =
        itineraryCache.get(
          cacheKey
        );

      if (
        cached &&
        Date.now() -
          cached.savedAt <
          ITINERARY_CACHE_TTL
      ) {
        const trip =
          await persistGeneratedTrip(
            request,
            cached.itinerary
          );

        return response.json({
          success: true,
          itinerary:
            cached.itinerary,
          tripId: trip.id,
          cached: true,
          error: null,
        });
      }

      if (!ai) {
        const itinerary =
          templateItinerary(
            prompt
          );

        itineraryCache.set(
          cacheKey,
          {
            itinerary,
            savedAt: Date.now(),
          }
        );

        const trip =
          await persistGeneratedTrip(
            request,
            itinerary
          );

        return response.json({
          success: true,
          itinerary,
          tripId: trip.id,
          fallback: true,
          message:
            "Live itinerary generation is temporarily unavailable.",
          error: null,
        });
      }

      try {
        const result =
          await retryOnce(() =>
            ai.models.generateContent({
              model:
                config.geminiModel,
              contents: `You are a practical travel planner. Create a useful itinerary for this request: "${prompt}". Write all user-facing itinerary content in the ${language} language. Return plain Markdown only. Use a title, a short summary, day-by-day headings, and concise sections for budget, accommodation, transport, food, packing, and safety. Do not return JSON or markdown code fences.`,
              config: {
                temperature: 0.55,
              },
            })
          );

        const itinerary =
          typeof result.text ===
          "string"
            ? result.text.trim()
            : "";

        if (!itinerary) {
          throw new Error(
            "Gemini returned an empty itinerary."
          );
        }

        itineraryCache.set(
          cacheKey,
          {
            itinerary,
            savedAt: Date.now(),
          }
        );

        const trip =
          await persistGeneratedTrip(
            request,
            itinerary
          );

        return response.json({
          success: true,
          itinerary,
          tripId: trip.id,
          error: null,
        });
      } catch (error) {
        console.error(
          `[${requestId}] Gemini itinerary request failed; using template fallback`,
          {
            status:
              error?.status ||
              error?.code,
            message:
              error instanceof Error
                ? error.message
                : String(error),
          }
        );

        const itinerary =
          templateItinerary(
            prompt
          );

        itineraryCache.set(
          cacheKey,
          {
            itinerary,
            savedAt: Date.now(),
          }
        );

        const trip =
          await persistGeneratedTrip(
            request,
            itinerary
          );

        return response.json({
          success: true,
          itinerary,
          tripId: trip.id,
          fallback: true,
          message:
            "Live itinerary generation is temporarily unavailable.",
          error: null,
        });
      }
    }
  );
