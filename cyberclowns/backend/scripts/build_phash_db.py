import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
import imagehash
from PIL import Image
from io import BytesIO


KNOWN_SITES = {
    "google.com": "https://accounts.google.com/signin",
    "facebook.com": "https://www.facebook.com/login",
    "paypal.com": "https://www.paypal.com/signin",
    "microsoft.com": "https://login.microsoftonline.com",
    "apple.com": "https://appleid.apple.com",
    "amazon.com": "https://www.amazon.com/ap/signin",
    "twitter.com": "https://twitter.com/i/flow/login",
    "instagram.com": "https://www.instagram.com/accounts/login",
    "linkedin.com": "https://www.linkedin.com/login",
    "github.com": "https://github.com/login",
    "netflix.com": "https://www.netflix.com/login",
    "dropbox.com": "https://www.dropbox.com/login",
}


async def build_phash_database():
    """Build pHash database for known legitimate login pages."""

    # Create directory structure
    data_dir = Path(__file__).parent.parent / "data"
    screenshots_dir = data_dir / "screenshots"
    data_dir.mkdir(exist_ok=True)
    screenshots_dir.mkdir(exist_ok=True)

    hashes = {}
    successful = 0
    total = len(KNOWN_SITES)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})

        for site_name, url in KNOWN_SITES.items():
            try:
                print(f"Processing {site_name}...", end=" ", flush=True)

                page = await context.new_page()

                # Set a timeout and navigate
                try:
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                except Exception as e:
                    print(f"❌ Navigation failed: {str(e)}")
                    await page.close()
                    continue

                # Take screenshot
                screenshot_path = screenshots_dir / f"{site_name}.png"
                await page.screenshot(path=str(screenshot_path))

                # Load image and compute pHash
                image = Image.open(screenshot_path)
                hash_obj = imagehash.phash(image)
                hash_str = str(hash_obj)

                hashes[site_name] = hash_str
                successful += 1

                print(f"✓ {hash_str[:16]}...")

                await page.close()

            except Exception as e:
                print(f"❌ Error: {str(e)}")
                continue

        await context.close()
        await browser.close()

    # Save to JSON
    output_file = data_dir / "known_hashes.json"
    with open(output_file, "w") as f:
        json.dump(hashes, f, indent=2)

    print(f"\n✅ Database built: {successful}/{total} sites successfully hashed")
    print(f"📁 Saved to: {output_file}")


if __name__ == "__main__":
    asyncio.run(build_phash_database())
