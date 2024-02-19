import { TextChannel } from "discord.js";

const DEBUG = true;
export const OUR_GUILD = "KillFeed";
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

  // always log to console and to error channel on our Discord server
  public error(error: Error | string) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }

    // Log the message to console
    LOGGER.debug(message);

    if (this.errorChannel) {
      // Add the dev Role
      if (this.devRole) {
        message = `<@&${this.devRole}>\n${message}`;
      }
      this.errorChannel.send(message);
    }
  }
}

export const LOGGER = new LogHandler();

function consoleLog(message?: any, ...optionalParams: any[]) {
  console.log(new Date().toUTCString() + " " + message, ...optionalParams);
}

// function to convert number of milliseconds into timespan string
export function msToTimeSpan(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days + " day" + (days == 1 ? "" : "s");
  }
  if (hours > 0) {
    return hours + " hour" + (hours == 1 ? "" : "s");
  }
  if (minutes > 0) {
    return minutes + " minute" + (minutes == 1 ? "" : "s");
  }
  if (seconds > 0) {
    return seconds + " second" + (seconds == 1 ? "" : "s");
  }
  return milliseconds + " millisecond" + (milliseconds == 1 ? "" : "s");
}
