import { ValidationPipe } from '@nestjs/common';
import { UpdateProductDto } from '../../src/modules/catalog/dto/update-product.dto';

/**
 * `homepage_sort: null` is how the admin panel takes a product back off a pinned
 * homepage position (migration 0041: the column is nullable on purpose). The
 * panel used to turn that `null` into `undefined`, which JSON drops, so the PATCH
 * skipped the field and the old position stayed; it now sends the `null`.
 *
 * That only works if the API takes it as `null`. `@Type(() => Number)` plus
 * `enableImplicitConversion` is exactly the combination that could coerce it to
 * `0` ("pinned first") or reject it, so this runs the DTO through the same
 * ValidationPipe options as `main.ts`.
 */

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const parse = (body: Record<string, unknown>): Promise<UpdateProductDto> =>
  pipe.transform(body, { type: 'body', metatype: UpdateProductDto });

describe('UpdateProductDto homepage_sort', () => {
  it('keeps null as null, so the position can be cleared', async () => {
    const dto = await parse({ homepage_sort: null });

    expect(dto.homepage_sort).toBeNull();
    expect(Object.keys(dto)).toContain('homepage_sort');
  });

  it('keeps a position as a number', async () => {
    expect((await parse({ homepage_sort: 3 })).homepage_sort).toBe(3);
    expect((await parse({ homepage_sort: '3' })).homepage_sort).toBe(3);
  });

  it('leaves the field out when the request omits it, so a PATCH does not touch it', async () => {
    const dto = await parse({ is_featured: true });

    expect(Object.keys(dto)).not.toContain('homepage_sort');
  });

  it('still rejects a non-integer position', async () => {
    await expect(parse({ homepage_sort: 1.5 })).rejects.toThrow();
    await expect(parse({ homepage_sort: 'first' })).rejects.toThrow();
  });
});
