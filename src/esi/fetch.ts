import axios, { AxiosError } from "axios";
import { KillMail } from "../zKillboard/zKillboard";
import { LOGGER } from "../helpers/Logger";

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

const url = "https://esi.evetech.net";

export async function fetchESINames(ids: number[]) {
  if (!ids || ids.length === 0) {
    return [] as Name[];
  }

  const path = "/universe/names/";

  return axios
    .post<Name[]>(url + path, ids)
    .then((response) => response.data)
    .catch((err: Error) => {
      if (err instanceof AxiosError) {
        LOGGER.error(
          `Axios error fetching Names from ESI at ${
            url + path
          } with '${ids.join(",")}': [${err.code}]${err.message}`
        );
      } else {
        LOGGER.error("General error fetcing Names from ESI: " + err.message);
      }
      return [] as Name[];
    });
}

export function fetchESIIDs(names: string[]) {
  const path = "/universe/ids/";

  return axios
    .post<IDs>(url + path, names)
    .then((response) => response.data)
    .catch((err: Error) => {
      if (err instanceof AxiosError) {
        LOGGER.error(
          `Axios error fetching IDs from ESI: [${err.code}]${err.message}`
        );
      } else {
        LOGGER.error("General error fetcing IDs from ESI: " + err.message);
      }
      return <IDs>{};
    });
}

export async function fetchKillmail(killmailId: string, hash: string) {
  if (!killmailId || !hash) {
    throw new Error("Must provide KM ID and Hash");
  }

  const path = `/killmails/${killmailId}/${hash}/`;
  const externalLink = `${url}${path}`;

  try {
    return await axios.get<KillMail>(externalLink, {
      "axios-retry": {
        retries: 3,
        retryDelay: (retryCount: number) => retryCount * 500,
        retryCondition: (error: AxiosError) => {
          const status = error.response?.status;
          return status === 429 || (status !== undefined && status >= 500);
        },
      },
    });
  } catch (err) {
    if (err instanceof AxiosError) {
      LOGGER.error(
        `Axios error fetching killmail from ESI (killmailId=${killmailId}, hash=${hash}) ` +
          `[status=${err.response?.status ?? "n/a"}, code=${
            err.code ?? "n/a"
          }] ${err.message} (${externalLink})`
      );
    } else if (err instanceof Error) {
      LOGGER.error(
        `General error fetching killmail from ESI (killmailId=${killmailId}, hash=${hash}) ` +
          `${err.message} (${externalLink})`
      );
    } else {
      LOGGER.error(
        `Unknown error fetching killmail from ESI (killmailId=${killmailId}, hash=${hash}) ` +
          `${String(err)} (${externalLink})`
      );
    }
  }
}
