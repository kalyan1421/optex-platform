import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('OPTEX API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/health', () => {
    it('returns 200 with status ok', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok')
        })
    })
  })

  describe('GET /api/catalog/products', () => {
    it('returns paginated product list', () => {
      return request(app.getHttpServer())
        .get('/api/catalog/products')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items')
          expect(res.body).toHaveProperty('total')
          expect(Array.isArray(res.body.items)).toBe(true)
        })
    })
  })

  describe('GET /api/catalog/categories', () => {
    it('returns array of categories', () => {
      return request(app.getHttpServer())
        .get('/api/catalog/categories')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true)
        })
    })
  })

  describe('GET /api/branches', () => {
    it('returns array of branches', () => {
      return request(app.getHttpServer())
        .get('/api/branches')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true)
        })
    })
  })

  describe('POST /api/auth routes require apikey', () => {
    it('GET /api/auth/me returns 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401)
    })
  })
})
