import { listActiveAnnouncements } from "../../../src/announcement-actions";

export async function GET() {
  const announcements = await listActiveAnnouncements();
  return Response.json({ announcements });
}
