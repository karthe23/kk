import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHmac } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const databaseFile = resolve(root, process.env.DATABASE_FILE || "./data/port-by-kk.json");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentProvider = process.env.PAYMENT_PROVIDER || "mock";

function localDatabase() {
  if (!existsSync(databaseFile)) return { bookings: [], payments: [] };
  return JSON.parse(readFileSync(databaseFile, "utf8"));
}

function writeLocalDatabase(database) {
  mkdirSync(dirname(databaseFile), { recursive: true });
  writeFileSync(databaseFile, JSON.stringify(database, null, 2));
}

const useSupabase = Boolean(supabaseUrl && supabaseKey);
async function databaseBookings() {
  if (!useSupabase) return localDatabase().bookings.slice().reverse();
  const response = await fetch(`${supabaseUrl}/rest/v1/bookings?select=data&order=created_at.desc`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
  if (!response.ok) throw new Error(`Database read failed (${response.status}).`);
  return (await response.json()).map((row) => row.data);
}

async function saveBooking(booking) {
  if (!useSupabase) {
    const database = localDatabase();
    database.bookings.push(booking);
    writeLocalDatabase(database);
    return;
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/bookings`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ id: booking.id, data: booking }) });
  if (!response.ok) throw new Error(`Database write failed (${response.status}).`);
}

async function updateBooking(booking) {
  if (!useSupabase) {
    const database = localDatabase();
    const index = database.bookings.findIndex((item) => item.id === booking.id);
    if (index >= 0) database.bookings[index] = booking;
    writeLocalDatabase(database);
    return;
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: "PATCH", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ data: booking }) });
  if (!response.ok) throw new Error(`Database update failed (${response.status}).`);
}

async function savePayment(payment) {
  if (!useSupabase) {
    const database = localDatabase();
    database.payments.push(payment);
    writeLocalDatabase(database);
    return;
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/payments`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ id: payment.id, booking_id: payment.bookingId, data: payment }) });
  if (!response.ok) throw new Error(`Payment record failed (${response.status}).`);
}

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": process.env.PUBLIC_BASE_URL || "*", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return value ? JSON.parse(value) : {};
}

function quote({ distance = 0, vehicle = "Tata Ace", goods = "General goods" }) {
  const rates = { "3 Wheeler": 16, "Tata Ace": 22, "Tata 407": 30, "Eicher 14 ft": 42, "Container 20 ft": 58 };
  return Math.max(850, Math.round(Number(distance) * (rates[vehicle] || 22) + 450 + (goods.toLowerCase().includes("fragile") ? 350 : 0)));
}

async function razorpayOrder(booking) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: booking.amount * 100, currency: "INR", receipt: booking.id, notes: { bookingId: booking.id } }) });
  if (!response.ok) throw new Error("Razorpay could not create the payment order.");
  return response.json();
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "OPTIONS") return json(response, 204, {});
  if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { ok: true, service: "port-by-kk-api", database: useSupabase ? "supabase" : "local-json", payments: paymentProvider });
  if (request.method === "GET" && url.pathname === "/api/config") return json(response, 200, { paymentProvider, razorpayKeyId: process.env.RAZORPAY_KEY_ID || null });
  if (request.method === "GET" && url.pathname === "/api/bookings") return json(response, 200, { bookings: await databaseBookings() });
  if (request.method === "POST" && url.pathname === "/api/quotes") return json(response, 200, { amount: quote(await body(request)), currency: "INR", estimate: "3-5 hours" });
  if (request.method === "POST" && url.pathname === "/api/bookings") {
    const input = await body(request);
    if (!input.pickup || !input.dropoff || !input.vehicle || !input.distance) return json(response, 400, { error: "Pickup, drop-off, vehicle and distance are required." });
    const booking = { id: `PRT-${randomUUID().slice(0, 8).toUpperCase()}`, ...input, amount: quote(input), status: "confirmed", paymentStatus: "pending", createdAt: new Date().toISOString(), eta: "Today, 4:30 PM" };
    await saveBooking(booking);
    return json(response, 201, { booking });
  }
  if (request.method === "POST" && url.pathname === "/api/payments/checkout") {
    const { bookingId } = await body(request);
    const booking = (await databaseBookings()).find((item) => item.id === bookingId);
    if (!booking) return json(response, 404, { error: "Booking not found." });
    if (paymentProvider === "razorpay") return json(response, 200, { provider: "razorpay", keyId: process.env.RAZORPAY_KEY_ID, order: await razorpayOrder(booking) });
    if (paymentProvider !== "mock") return json(response, 503, { error: "Payment provider is not configured." });
    const payment = { id: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`, bookingId, amount: booking.amount, status: "paid", provider: "mock", createdAt: new Date().toISOString() };
    booking.paymentStatus = "paid";
    await updateBooking(booking);
    await savePayment(payment);
    return json(response, 200, { payment, message: "Mock payment recorded." });
  }
  if (request.method === "POST" && url.pathname === "/api/payments/verify") {
    const input = await body(request);
    if (paymentProvider !== "razorpay") return json(response, 400, { error: "Razorpay verification is not enabled." });
    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${input.orderId}|${input.paymentId}`).digest("hex");
    if (expected !== input.signature) return json(response, 400, { error: "Payment signature verification failed." });
    const booking = (await databaseBookings()).find((item) => item.id === input.bookingId);
    if (!booking) return json(response, 404, { error: "Booking not found." });
    booking.paymentStatus = "paid";
    await updateBooking(booking);
    await savePayment({ id: input.paymentId, bookingId: input.bookingId, amount: booking.amount, status: "paid", provider: "razorpay", createdAt: new Date().toISOString() });
    return json(response, 200, { message: "Payment verified successfully." });
  }
  return json(response, 404, { error: "Route not found." });
}

createServer((request, response) => {
  if (request.url.startsWith("/api/")) return route(request, response).catch((error) => json(response, 500, { error: error.message }));
  const file = request.url === "/" ? "public/index.html" : request.url.slice(1);
  const safeFile = resolve(root, file);
  if (!safeFile.startsWith(resolve(root, "public"))) return json(response, 403, { error: "Forbidden" });
  try {
    const content = readFileSync(safeFile);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json" };
    response.writeHead(200, { "Content-Type": types[safeFile.slice(safeFile.lastIndexOf("."))] || "application/octet-stream" });
    response.end(content);
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(port, () => console.log(`Port by kk is running at http://localhost:${port}`));
