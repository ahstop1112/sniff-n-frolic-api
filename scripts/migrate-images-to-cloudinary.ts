// scripts/migrate-images-to-cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

cloudinary.config({
  cloud_name: 'dv6wcydbt',
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const UPLOADS_DIR = process.env.UPLOADS_DIR!; // 本地 download 嘅路徑

const uploadToCloudinary = async (localPath: string, publicId: string) => {
  const result = await cloudinary.uploader.upload(localPath, {
    public_id: publicId,
    folder: 'sniff-n-frolic',
    overwrite: false,
  });
  return result.secure_url;
};

const migrateImages = async () => {
  const client = await pool.connect();

  try {
    // 攞所有圖片 URL
    const { rows: images } = await client.query(`
      SELECT id, url FROM product_images
      WHERE url LIKE '%sniffnfrolic.com/wp-content/uploads%'
    `);

    console.log(`Found ${images.length} images to migrate`);

    for (const img of images) {
      const urlPath = new URL(img.url).pathname; // /wp-content/uploads/2025/07/xxx.webp
      const relativePath = urlPath.replace('/wp-content/uploads/', '');
      const localPath = path.join(UPLOADS_DIR, relativePath);

      if (!fs.existsSync(localPath)) {
        console.warn(`File not found: ${localPath}`);
        continue;
      }

      const publicId = relativePath.replace(/\.[^/.]+$/, ''); // remove extension
      
      try {
        const newUrl = await uploadToCloudinary(localPath, publicId);
        await client.query(
          `UPDATE product_images SET url = $1 WHERE id = $2`,
          [newUrl, img.id]
        );
        console.log(`✅ ${relativePath} → ${newUrl}`);
      } catch (err) {
        console.error(`❌ Failed: ${relativePath}`, err);
      }
    }

    // 同埋更新 featured_image_url
    const { rows: products } = await client.query(`
      SELECT id, featured_image_url FROM products
      WHERE featured_image_url LIKE '%sniffnfrolic.com/wp-content/uploads%'
    `);

    console.log(`Found ${products.length} featured images to migrate`);

    for (const p of products) {
      const urlPath = new URL(p.featured_image_url).pathname;
      const relativePath = urlPath.replace('/wp-content/uploads/', '');
      const localPath = path.join(UPLOADS_DIR, relativePath);

      if (!fs.existsSync(localPath)) {
        console.warn(`File not found: ${localPath}`);
        continue;
      }

      const publicId = relativePath.replace(/\.[^/.]+$/, '');

      try {
        const newUrl = await uploadToCloudinary(localPath, publicId);
        await client.query(
          `UPDATE products SET featured_image_url = $1 WHERE id = $2`,
          [newUrl, p.id]
        );
        console.log(`✅ featured: ${relativePath} → ${newUrl}`);
      } catch (err) {
        console.error(`❌ Failed featured: ${relativePath}`, err);
      }
    }

    console.log('Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
};

migrateImages().catch(console.error);