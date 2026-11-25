export interface Court {
  id: string;
  location_id: string;
  name: string;
  sport: 'tennis' | 'padel';
  is_singles_only: boolean;
  is_doubles_or_singles: boolean;
  court_type: 'indoor' | 'outdoor';
  surface_type: string;
  photo_url: string | null;
  is_active: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  courts?: Court[];
  created_at?: string;
}

export interface PreferredLocation {
  id: string;
  location_id: string;
  use_in_search: boolean;
  location: Location;
}
