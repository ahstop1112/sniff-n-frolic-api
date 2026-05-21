import { Controller, Get, Post, Put, Body, Param, NotFoundException, HttpCode } from '@nestjs/common'
import { BrandsRepository } from './brands.repository'
import { CreateBrandDto } from './dto/create-brand.dto'
import { UpdateBrandDto } from './dto/update-brand.dto'

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsRepository: BrandsRepository) {}

    @Get()
    async findAll() {
        return this.brandsRepository.findAll()
    }

    @Post()
    @HttpCode(201)
    async create(@Body() body: CreateBrandDto) {
        return this.brandsRepository.create(body.name)
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() body: UpdateBrandDto) {
        const updated = await this.brandsRepository.update(id, body.name)
        if (!updated) throw new NotFoundException(`Brand "${id}" not found`)
        return updated
    }
}