-- 014_products_meta_seo.sql
-- Add SEO meta fields to products table

ALTER TABLE products
  ADD COLUMN meta_title       VARCHAR(60),
  ADD COLUMN meta_description VARCHAR(160);