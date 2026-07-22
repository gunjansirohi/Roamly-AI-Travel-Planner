import { render, screen } from '@testing-library/react';
import App from './App';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
  render(<MemoryRouter><ThemeProvider><AuthProvider><CurrencyProvider><TripsProvider><App /></TripsProvider></CurrencyProvider></AuthProvider></ThemeProvider></MemoryRouter>);
  const heading = screen.getByRole('heading', { level: 1, name: /explore the world with ai/i });
  expect(heading).toBeInTheDocument();
});
