// Set the DATABASE_URL environment variable so we can import db
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_J5uWlpmhcDa8@ep-frosty-cell-atv80wog.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

const { db } = require("./lib/db/index");
const { scheduledPosts } = require("./lib/db/schema");

async function main() {
  const posts = await db.select().from(scheduledPosts).limit(1);
  if (posts.length === 0) {
    console.log("No posts found");
    return;
  }
  const post = posts[0];
  console.log("=== Drizzle DB query ===");
  console.log("scheduledFor (raw JS value):", post.scheduledFor);
  console.log("scheduledFor instanceof Date:", post.scheduledFor instanceof Date);
  console.log("scheduledFor.toISOString():", post.scheduledFor.toISOString());
  console.log("scheduledFor.toString():", post.scheduledFor.toString());
}

main().catch(console.error);
