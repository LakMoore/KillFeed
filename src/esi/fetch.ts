import axios, { AxiosError } from "axios";
import { KillMail } from "../zKillboard/zKillboard";

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

  return axios
    .post<Name[]>(url + path, ids)
    .then((response) => response.data)
    .catch((err: Error) => {
      if (err instanceof AxiosError) {
        console.log(
          `Axios error fetching Names from ESI: [${err.code}]${err.message}`
        );
      } else {
        console.log("General error fetcing Names from ESI: " + err.message);
      }
      return <Name[]>[];
    });
}

export function fetchESIIDs(names: string[]) {
  const path = "/universe/ids/";

  return axios
    .post<IDs>(url + path, names)
    .then((response) => response.data)
    .catch((err: Error) => {
      if (err instanceof AxiosError) {
        console.log(
          `Axios error fetching IDs from ESI: [${err.code}]${err.message}`
        );
      } else {
        console.log("General error fetcing IDs from ESI: " + err.message);
      }
      return <IDs>{};
    });
}

export function fetchKillmail(killmailId: string, hash: string) {
  if (killmailId && hash) {
    const path = `/killmails/${killmailId}/${hash}/`;

    return axios.get<KillMail>(url + path);
  }
  return Promise.reject("Must provide KM ID and Hash");
}
