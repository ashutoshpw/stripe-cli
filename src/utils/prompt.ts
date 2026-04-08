/**
 * Minimal stdin prompt helper.
 * Used ONLY during interactive commands (auth setup, profile create).
 */

/**
 * Prompt the user for input and return their response.
 */
export async function prompt(message: string): Promise<string> {
  process.stdout.write(message);

  const reader = process.stdin;

  return new Promise<string>((resolve) => {
    const wasRaw = reader.readableFlowing;

    let data = "";

    const onData = (chunk: Buffer) => {
      const str = chunk.toString();
      data += str;
      if (str.includes("\n")) {
        reader.removeListener("data", onData);
        if (!wasRaw) {
          reader.pause();
        }
        resolve(data.trim());
      }
    };

    reader.on("data", onData);
    reader.resume();
  });
}

/**
 * Prompt for input with a default value.
 * Shows: "message [default]: "
 */
export async function promptWithDefault(
  message: string,
  defaultValue: string,
): Promise<string> {
  const answer = await prompt(`${message} [${defaultValue}]: `);
  return answer || defaultValue;
}

/**
 * Prompt for a yes/no confirmation.
 * Returns true for y/yes, false for n/no.
 */
export async function confirm(
  message: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await prompt(`${message} (${hint}): `);

  if (!answer) return defaultYes;

  return answer.toLowerCase().startsWith("y");
}
