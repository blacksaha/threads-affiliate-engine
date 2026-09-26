require('dotenv').config();

async function checkLive() {
  console.log("Checking live Threads profile for new posts...");
  
  const myProfileUrl = "https://www.threads.com/@suci34net/post/";
  
  // Fetch main threads page to find last posted thread IDs
  console.log("We can't verify the actual content from here as we don't have login cookie.");
  console.log("Please manually check your Threads profile at: https://www.threads.com/@suci34net");
  console.log("Look for a post created recently titled something like 'Test' or matching your recent queue posts.");
}

checkLive();
