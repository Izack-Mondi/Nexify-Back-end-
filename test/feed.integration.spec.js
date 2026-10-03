"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const graphql_1 = require("@nestjs/graphql");
const apollo_1 = require("@nestjs/apollo");
const prisma_service_1 = require("../src/prisma/prisma.service");
const feed_resolver_1 = require("../src/feed/feed.resolver");
const feed_service_1 = require("../src/feed/feed.service");
const auth_module_1 = require("../src/auth/auth.module");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const request = __importStar(require("supertest"));
describe('Feed Integration Tests', () => {
    let app;
    let prisma;
    let jwtService;
    let authToken;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [
                config_1.ConfigModule.forRoot({
                    isGlobal: true,
                }),
                graphql_1.GraphQLModule.forRoot({
                    driver: apollo_1.ApolloDriver,
                    autoSchemaFile: true,
                    sortSchema: true,
                    context: ({ req }) => ({ req }),
                }),
                auth_module_1.AuthModule,
            ],
            providers: [feed_resolver_1.FeedResolver, feed_service_1.FeedService, prisma_service_1.PrismaService],
        }).compile();
        app = moduleFixture.createNestApplication();
        prisma = moduleFixture.get(prisma_service_1.PrismaService);
        jwtService = moduleFixture.get(jwt_1.JwtService);
        await app.init();
        const user = await prisma.user.create({
            data: {
                fullName: 'Test User',
                email: 'test@example.com',
                phoneNumber: '+254700000000',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                passwordHash: 'hashed_password',
            },
        });
        authToken = jwtService.sign({ sub: user.id });
    });
    afterAll(async () => {
        await prisma.post.deleteMany();
        await prisma.user.deleteMany();
        await app.close();
    });
    describe('Pagination with same-timestamp posts', () => {
        beforeEach(async () => {
            await prisma.post.deleteMany();
            const sameTimestamp = new Date('2024-01-01T00:00:00.000Z');
            const user = await prisma.user.findFirst();
            for (let i = 0; i < 10; i++) {
                await prisma.post.create({
                    data: {
                        authorId: user.id,
                        type: 'GENERAL',
                        vertical: 'BUSINESS',
                        caption: `Same timestamp post ${i}`,
                        createdAt: sameTimestamp,
                    },
                });
            }
        });
        it('should return all 10 same-timestamp posts without gaps when paginating', async () => {
            const seenIds = new Set();
            let cursor;
            let totalFetched = 0;
            while (totalFetched < 10) {
                const query = `
          query HomeFeed($first: Int!, $after: String) {
            homeFeed(input: { first: $first, after: $after }) {
              edges {
                node {
                  id
                  caption
                }
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;
                const response = await request(app.getHttpServer())
                    .post('/graphql')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                    query,
                    variables: { first: 3, after: cursor },
                });
                const result = response.body.data.homeFeed;
                const edges = result.edges;
                for (const edge of edges) {
                    expect(seenIds.has(edge.node.id)).toBe(false);
                    seenIds.add(edge.node.id);
                }
                totalFetched += edges.length;
                cursor = result.pageInfo.endCursor;
                if (!result.pageInfo.hasNextPage) {
                    break;
                }
            }
            expect(totalFetched).toBe(10);
            expect(seenIds.size).toBe(10);
        });
    });
    describe('Authentication protection', () => {
        it('should reject unauthenticated homeFeed request', async () => {
            const query = `
        query HomeFeed {
          homeFeed(input: { first: 10 }) {
            edges {
              node {
                id
              }
            }
          }
        }
      `;
            const response = await request(app.getHttpServer())
                .post('/graphql')
                .send({ query });
            expect(response.body.errors).toBeDefined();
            expect(response.body.errors[0].message).toContain('Authorization header required');
        });
        it('should reject unauthenticated createPost request', async () => {
            const mutation = `
        mutation CreatePost {
          createPost(type: GENERAL, caption: "Test post") {
            id
          }
        }
      `;
            const response = await request(app.getHttpServer())
                .post('/graphql')
                .send({ query: mutation });
            expect(response.body.errors).toBeDefined();
            expect(response.body.errors[0].message).toContain('Authorization header required');
        });
    });
    describe('PII protection', () => {
        beforeEach(async () => {
            await prisma.post.deleteMany();
            const user = await prisma.user.findFirst();
            await prisma.post.create({
                data: {
                    authorId: user.id,
                    type: 'GENERAL',
                    vertical: 'BUSINESS',
                    caption: 'Test post',
                },
            });
        });
        it('should not expose email in PostAuthor', async () => {
            const query = `
        query HomeFeed {
          homeFeed(input: { first: 10 }) {
            edges {
              node {
                author {
                  id
                  fullName
                  email
                  phoneNumber
                  location
                  isVerified
                }
              }
            }
          }
        }
      `;
            const response = await request(app.getHttpServer())
                .post('/graphql')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query });
            const author = response.body.data.homeFeed.edges[0].node.author;
            expect(author.email).toBeUndefined();
            expect(author.phoneNumber).toBeUndefined();
            expect(author.id).toBeDefined();
            expect(author.fullName).toBeDefined();
            expect(author.isVerified).toBeDefined();
        });
        it('should expose contact info only via postContact query', async () => {
            const post = await prisma.post.findFirst();
            const query = `
        query PostContact($postId: ID!) {
          postContact(postId: $postId) {
            id
            fullName
            phoneNumber
          }
        }
      `;
            const response = await request(app.getHttpServer())
                .post('/graphql')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                query,
                variables: { postId: post.id },
            });
            const contact = response.body.data.postContact;
            expect(contact.id).toBeDefined();
            expect(contact.fullName).toBeDefined();
            expect(contact.phoneNumber).toBeDefined();
        });
    });
    describe('Vertical assignment', () => {
        it('should assign correct vertical when creating post with product', async () => {
            const user = await prisma.user.findFirst();
            const product = await prisma.product.create({
                data: {
                    name: 'Tomatoes',
                    price: 50,
                    unit: 'kg',
                    category: 'crops',
                    sellerId: user.id,
                },
            });
            const post = await prisma.post.create({
                data: {
                    authorId: user.id,
                    type: 'MARKETPLACE',
                    vertical: 'AGRICULTURE',
                    caption: 'Fresh tomatoes',
                    productId: product.id,
                },
            });
            expect(post.vertical).toBe('AGRICULTURE');
        });
    });
});
//# sourceMappingURL=feed.integration.spec.js.map