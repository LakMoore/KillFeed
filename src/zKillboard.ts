export interface Character {
  alliance_id: number;
  character_id: number;
  corporation_id: number;
  ship_type_id: number;
}
interface Attacker extends Character {
  damage_done: number;
  final_blow: boolean;
  security_status: number;
  weapon_type_id: number;
}

interface Victim extends Character {
  damage_taken: number;
  items: [];
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface KillMail {
  attackers: [Attacker];
  killmail_id: number;
  killmail_time: Date;
  solar_system_id: number;
  victim: Victim;
}

export interface Package {
  package: {
    killID: number;
    killmail: KillMail;
    zkb: {
      locationID: number;
      hash: string;
      fittedValue: number;
      droppedValue: number;
      destroyedValue: number;
      totalValue: number;
      points: number;
      npc: boolean;
      solo: boolean;
      awox: boolean;
      labels: [string];
      href: string;
    };
  };
}
