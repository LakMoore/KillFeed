import dotenv from "dotenv";
import { TextChannel } from "discord.js";

dotenv.config();
const DEBUG = process.env.NODE_ENV === "development";

export const OUR_GUILD = "KillFeed by Lak Moore";
export const ERROR_CHANNEL = "bot-errors";
export const DEV_ROLE = "Developer";

export class LogHandler {
  private errorChannel: TextChannel | undefined;
  private devRole: string | undefined;

  public setErrorChannel(channel: TextChannel) {
    this.errorChannel = channel;
  }

  public setDevRole(role: string) {
    this.devRole = role;
  }

  // always just log to console
  public info(message: string) {
    consoleLog(message);
  }

  // log to console only if DEBUG is true
  public debug(message: string) {
    if (DEBUG) {
      consoleLog(message);
    }
  }

  // always log to console and to error channel on our Discord server (no ping!)
  public warning(error: Error | string) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }

    // Log the message to console
    consoleError(message);

    if (this.errorChannel) {
      // No pings for warnings
      void this.errorChannel.send(message).catch(() => undefined);
    }
  }

  // always log to console and to error channel on our Discord server
  public error(error: Error | string) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }

    // Log the message to console
    consoleError(message);

    if (this.errorChannel) {
      // Add the dev Role
      if (this.devRole) {
        message = `<@&${this.devRole}>\n${message}`;
      }
      void this.errorChannel.send(message).catch(() => undefined);
    }
  }
}

export const LOGGER = new LogHandler();

function consoleLog(message: object | string, ...optionalParams: object[]) {
  console.log(new Date().toUTCString() + " " + message, ...optionalParams);
}

function consoleError(message: object | string, ...optionalParams: object[]) {
  console.error(new Date().toUTCString() + " " + message, ...optionalParams);
}

// function to convert number of milliseconds into timespan string
export function msToTimeSpan(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  const remainingMilliseconds = milliseconds % 1000;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(days + " day" + (days == 1 ? "" : "s"));
  }
  if (remainingHours > 0) {
    parts.push(remainingHours + " hour" + (remainingHours == 1 ? "" : "s"));
  }
  if (remainingMinutes > 0) {
    parts.push(
      remainingMinutes + " minute" + (remainingMinutes == 1 ? "" : "s")
    );
  }
  if (remainingSeconds > 0) {
    parts.push(
      remainingSeconds + " second" + (remainingSeconds == 1 ? "" : "s")
    );
  }

  if (parts.length === 0) {
    parts.push(
      remainingMilliseconds +
        " millisecond" +
        (remainingMilliseconds == 1 ? "" : "s")
    );
  }

  return parts.join(" ");
}
