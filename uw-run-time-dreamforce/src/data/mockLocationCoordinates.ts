export type LocationCoordinate = {
  lat: number;
  lng: number;
  address: string;
};

export const locationCoordinates: Record<string, LocationCoordinate> = {
  'a01SB00001p8B6rYAE': {
    lat: 41.8866,
    lng: -87.6593,
    address: '1450 W Fulton St, Chicago, IL 60607',
  },
  'a01SB00001p85SsYAI': {
    lat: 30.2672,
    lng: -97.7431,
    address: '500 W 2nd St, Austin, TX 78701',
  },
  'a01SB00001pDUP3A': {
    lat: 37.3782,
    lng: -121.9785,
    address: '2500 Augustine Dr, San Jose, CA 95054',
  },
  'a01SB00001pDUP3B': {
    lat: 37.3782,
    lng: -121.9785,
    address: '2500 Augustine Drive, San Jose, CA 95054',
  },
  'a01SB00001pGYavYAG': {
    lat: 41.8866,
    lng: -87.6593,
    address: '1450 W Fulton St, Chicago, IL 60607',
  },
  'a01SB00001pGYmDYAW': {
    lat: 30.2672,
    lng: -97.7431,
    address: '500 W 2nd St, Austin, TX 78701',
  },
};
