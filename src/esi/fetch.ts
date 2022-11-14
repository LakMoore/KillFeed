import axios from "axios";

export interface Name {
  category: string;
  id: number;
  name: string;
}

export interface IDs {
  agents?: [
    {
      id: number;
      name: string;
    }
  ];
  alliances?: [
    {
      id: number;
      name: string;
    }
  ];
  characters?: [
    {
      id: number;
      name: string;
    }
  ];
  constellations?: [
    {
      id: number;
      name: string;
    }
  ];
  corporations?: [
    {
      id: number;
      name: string;
    }
  ];
  factions?: [
    {
      id: number;
      name: string;
    }
  ];
  inventory_types?: [
    {
      id: number;
      name: string;
    }
  ];
  regions?: [
    {
      id: number;
      name: string;
    }
  ];
  stations?: [
    {
      id: number;
      name: string;
    }
  ];
  systems?: [
    {
      id: number;
      name: string;
    }
  ];
}

const url = "https://esi.evetech.net/latest";

export function fetchESINames(ids: number[]) {
  const path = "/universe/names/";

  return axios.post<Name[]>(url + path, ids).then((response) => response.data);
}

export function fetchESIIDs(names: string[]) {
  const path = "/universe/ids/";

  return axios.post<IDs>(url + path, names).then((response) => response.data);
}
