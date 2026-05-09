import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'
import { ProductsRepository } from './products.repository'
import { WooService } from './woo.services'
import { mapWooProductToImportRow } from './products.mapper'

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp/g, '&')
    .replace(/&lt/g, '<')
    .replace(/&gt/g, '>')
    .replace(/&quot/g, '"')
    .replace(/&#039/g, "'")

@Injectable()
export class ProductsImporter {
  private readonly logger = new Logger(ProductsImporter.name)

  public constructor(
    private readonly wooService: WooService,
    private readonly productsRepository: ProductsRepository,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    this.logger.log(`Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`)
  }

  private uploadToCloudinary = async (url: string, publicId: string): Promise<string> => {
    try {
      const existing = await cloudinary.api.resource(`sniff-n-frolic/${publicId}`)
      this.logger.log(`Already exists: ${publicId}`)
      return existing.secure_url
    } catch {
      try {
        // uploads folder upload
        const urlPath = new URL(url).pathname
        const relativePath = urlPath.replace('/wp-content/uploads/', '')
        const localPath = `${process.env.UPLOADS_DIR}/${relativePath}`
        
        const fs = require('fs')
        const uploadSource = fs.existsSync(localPath) ? localPath : url
  
        const result = await cloudinary.uploader.upload(uploadSource, {
          public_id: publicId,
          folder: 'sniff-n-frolic',
        })
        this.logger.log(`✅ Uploaded: ${publicId}`)
        return result.secure_url
      } catch (err) {
        this.logger.error(`❌ Failed to upload: ${url}`, err)
        return url
      }
    }
  }

  private uploadImages = async (
    images: { src: string }[],
    slug: string,
  ): Promise<{ src: string }[]> => {
    return Promise.all(
      images.map(async (img, i) => ({
        ...img,
        src: await this.uploadToCloudinary(img.src, `${slug}-${i}`),
      }))
    )
  }

  public importAll = async () => {
    let page = 1
    let totalImported = 0

    const categoryCache = new Map<string, string>()

    const resolveCategoryId = async (slug: string, name: string): Promise<string> => {
      if (categoryCache.has(slug)) return categoryCache.get(slug)!
      const id = await this.productsRepository.upsertCategory({
        name: decodeHtmlEntities(name),
        slug,
      })
      categoryCache.set(slug, id)
      return id
    }

    while (true) {
      this.logger.log(`Fetching Woo products page ${page}`)

      const products = await this.wooService.fetchProducts(page, 100)
      if (!products.length) break

      for (const product of products) {
        const categories = product.categories ?? []
        const categoryIds: string[] = []
        for (const cat of categories) {
          const id = await resolveCategoryId(cat.slug, cat.name)
          categoryIds.push(id)
        }
        const categoryId = categoryIds[0] ?? null

        if (product.type === 'variable') {
          // Upload parent images
          const uploadedImages = await this.uploadImages(product.images ?? [], product.slug)
          const productWithCloudinary = { ...product, images: uploadedImages }
          const parentRow = mapWooProductToImportRow(productWithCloudinary, categoryId, categoryIds)
          await this.productsRepository.upsertImportedProduct(parentRow)

          let varPage = 1
          while (true) {
            const variations = await this.wooService.fetchVariations(product.id, varPage)
            if (!variations.length) break

            for (const variation of variations) {
              const varImages = variation.image ? [variation.image] : (product.images ?? [])
              const uploadedVarImages = await this.uploadImages(varImages, `${product.slug}-${variation.id}`)

              const variationWithMeta = {
                ...variation,
                type: 'variation',
                name: variation.name
                  ? `${product.name} — ${variation.name}`
                  : product.name,
                categories: product.categories,
                slug: `${product.slug}-${variation.id}`,
                images: uploadedVarImages,
              }
              const row = mapWooProductToImportRow(variationWithMeta, categoryId, categoryIds)
              const imported = await this.productsRepository.upsertImportedProduct(row)

              if (variation.attributes?.length) {
                await this.productsRepository.upsertVariationAttributes(
                  imported.id,
                  variation.attributes.map((attr: any) => ({
                    name: attr.name,
                    slug: attr.slug,
                    optionValue: attr.option,
                  }))
                )
              }
            }

            varPage++
          }
        } else {
          const uploadedImages = await this.uploadImages(product.images ?? [], product.slug)
          const productWithCloudinary = { ...product, images: uploadedImages }
          const row = mapWooProductToImportRow(productWithCloudinary, categoryId, categoryIds)
          await this.productsRepository.upsertImportedProduct(row)
        }
      }

      totalImported += products.length
      this.logger.log(`Imported page ${page}: ${products.length} products`)
      page += 1
    }

    this.logger.log(`Import complete. Total imported: ${totalImported}`)
    return { success: true, totalImported }
  }
}