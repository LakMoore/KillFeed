const DEBUG = true;

export function consoleLog(message?: any, ...optionalParams: any[]) {
  if (DEBUG) {
    console.log(new Date().toUTCString() + " " + message, ...optionalParams);
  }
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
