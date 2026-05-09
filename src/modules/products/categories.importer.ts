import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'
import { ProductsRepository } from './products.repository'
import { WooService } from './woo.services'
import { WooCategory } from './products.types'

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

@Injectable()
export class CategoriesImporter {
  private readonly logger = new Logger(CategoriesImporter.name)

  public constructor(
    private readonly wooService: WooService,
    private readonly productsRepository: ProductsRepository,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
  }

  private uploadToCloudinary = async (url: string, publicId: string): Promise<string> => {
    try {
      const existing = await cloudinary.api.resource(`sniff-n-frolic/${publicId}`)
      return existing.secure_url
    } catch {
      try {
        const fs = require('fs')
        const urlPath = new URL(url).pathname
        const relativePath = urlPath.replace('/wp-content/uploads/', '')
        const localPath = `${process.env.UPLOADS_DIR}/${relativePath}`
        const uploadSource = fs.existsSync(localPath) ? localPath : url

        const result = await cloudinary.uploader.upload(uploadSource, {
          public_id: publicId,
          folder: 'sniff-n-frolic',
        })
        this.logger.log(`✅ Uploaded category image: ${publicId}`)
        return result.secure_url
      } catch (err) {
        this.logger.error(`❌ Failed: ${url}`, err)
        return url
      }
    }
  }

  public importAll = async () => {
    let page = 1
    let totalImported = 0
    const allCategories: WooCategory[] = []

    while (true) {
      this.logger.log(`Fetching Woo categories page ${page}`)
      const categories = await this.wooService.fetchCategories(page, 100)
      if (!categories.length) break
      allCategories.push(...categories)
      page += 1
    }

    const wooIdToSlug = new Map<number, string>()
    for (const c of allCategories) {
      wooIdToSlug.set(c.id, c.slug)
    }

    const topLevel = allCategories.filter((c) => c.parent === `0`)
    const children = allCategories.filter((c) => c.parent !== `0`)

    for (const c of [...topLevel, ...children]) {
      const parentSlug = c.parent !== `0` ? (wooIdToSlug.get(Number(c.parent)) ?? null) : null

      let imageUrl = c.image?.src ?? null
      if (imageUrl) {
        imageUrl = await this.uploadToCloudinary(imageUrl, `category-${c.slug}`)
      }

      await this.productsRepository.upsertCategoryWithParent({
        name: decodeHtmlEntities(c.name),
        slug: c.slug,
        parentSlug,
        imageUrl,
      })

      totalImported += 1
    }

    this.logger.log(`Category import complete. Total: ${totalImported}`)
    return { success: true, totalImported }
  }
}