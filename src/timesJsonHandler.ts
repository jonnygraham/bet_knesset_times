import { calculateTimes } from "./lookupTimes"

export async function handler(event) {
  const params = event.queryStringParameters ?? {};
  const times = await calculateTimes(params);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(times),
  };
}
