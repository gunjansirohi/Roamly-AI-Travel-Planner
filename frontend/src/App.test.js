import { render, screen } from '@testing-library/react';
import App from './App';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { TripsProvider } from './context/TripsContext';

jest.mock('leaflet', () => ({ icon: () => ({}), divIcon: () => ({}) }));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ flyTo: jest.fn(), getContainer: () => globalThis.document.createElement('div') }),
}));

test('renders the travel planner hero headline', () => {
  render(<ThemeProvider><CurrencyProvider><TripsProvider><App /></TripsProvider></CurrencyProvider></ThemeProvider>);
  const heading = screen.getByRole('heading', { level: 1, name: /explore the world with ai/i });
  expect(heading).toBeInTheDocument();
});
