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
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting seed...');
    await prisma.post.deleteMany();
    await prisma.product.deleteMany();
    await prisma.service.deleteMany();
    await prisma.verificationCode.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    const users = await Promise.all([
        prisma.user.create({
            data: {
                fullName: 'John Farmer',
                email: 'john@example.com',
                phoneNumber: '+254700000001',
                location: 'Nairobi',
                county: 'Nairobi',
                interests: ['agriculture', 'farming'],
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                passwordHash: await bcrypt.hash('password123', 10),
            },
        }),
        prisma.user.create({
            data: {
                fullName: 'Mary Business',
                email: 'mary@example.com',
                phoneNumber: '+254700000002',
                location: 'Mombasa',
                county: 'Mombasa',
                interests: ['business', 'services'],
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                passwordHash: await bcrypt.hash('password123', 10),
            },
        }),
        prisma.user.create({
            data: {
                fullName: 'Peter Crops',
                email: 'peter@example.com',
                phoneNumber: '+254700000003',
                location: 'Kisumu',
                county: 'Kisumu',
                interests: ['crops', 'agriculture'],
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: false,
                passwordHash: await bcrypt.hash('password123', 10),
            },
        }),
        prisma.user.create({
            data: {
                fullName: 'Grace Livestock',
                email: 'grace@example.com',
                phoneNumber: '+254700000004',
                location: 'Nakuru',
                county: 'Nakuru',
                interests: ['livestock', 'dairy'],
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                passwordHash: await bcrypt.hash('password123', 10),
            },
        }),
        prisma.user.create({
            data: {
                fullName: 'James Service',
                email: 'james@example.com',
                phoneNumber: '+254700000005',
                location: 'Eldoret',
                county: 'Uasin Gishu',
                interests: ['services', 'business'],
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                passwordHash: await bcrypt.hash('password123', 10),
            },
        }),
    ]);
    console.log(`Created ${users.length} users`);
    const agricultureCategories = ['crops', 'livestock', 'dairy', 'produce', 'poultry', 'fish', 'farm inputs'];
    const businessCategories = ['electronics', 'clothing', 'furniture', 'services', 'machinery'];
    const products = await Promise.all([
        prisma.product.create({
            data: {
                name: 'Fresh Tomatoes',
                description: 'Organic tomatoes from the farm',
                price: 50,
                unit: 'kg',
                category: 'crops',
                location: 'Nairobi',
                sellerId: users[0].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Dairy Cow',
                description: 'Healthy dairy cow for sale',
                price: 50000,
                unit: 'piece',
                category: 'livestock',
                location: 'Nakuru',
                sellerId: users[3].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Maize Seeds',
                description: 'High yield maize seeds',
                price: 500,
                unit: 'kg',
                category: 'seeds',
                location: 'Kisumu',
                sellerId: users[2].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Organic Fertilizer',
                description: 'Natural fertilizer for crops',
                price: 2000,
                unit: 'bag',
                category: 'farm inputs',
                location: 'Nairobi',
                sellerId: users[0].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Poultry Feed',
                description: 'Quality poultry feed',
                price: 1500,
                unit: 'bag',
                category: 'poultry',
                location: 'Nakuru',
                sellerId: users[3].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Fresh Fish',
                description: 'Fresh tilapia from the lake',
                price: 300,
                unit: 'kg',
                category: 'fish',
                location: 'Kisumu',
                sellerId: users[2].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Laptop Computer',
                description: 'Business laptop for sale',
                price: 45000,
                unit: 'piece',
                category: 'electronics',
                location: 'Mombasa',
                sellerId: users[1].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Office Furniture',
                description: 'Modern office desk and chair',
                price: 15000,
                unit: 'set',
                category: 'furniture',
                location: 'Nairobi',
                sellerId: users[0].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Clothing Bundle',
                description: 'Mixed clothing items',
                price: 5000,
                unit: 'bundle',
                category: 'clothing',
                location: 'Mombasa',
                sellerId: users[1].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Construction Machinery',
                description: 'Heavy construction equipment',
                price: 200000,
                unit: 'piece',
                category: 'machinery',
                location: 'Eldoret',
                sellerId: users[4].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Business Software',
                description: 'Accounting software',
                price: 10000,
                unit: 'license',
                category: 'services',
                location: 'Nairobi',
                sellerId: users[0].id,
            },
        }),
        prisma.product.create({
            data: {
                name: 'Farm Tractor',
                description: 'Used farm tractor',
                price: 800000,
                unit: 'piece',
                category: 'farm machinery',
                location: 'Uasin Gishu',
                sellerId: users[4].id,
            },
        }),
    ]);
    console.log(`Created ${products.length} products`);
    const services = await Promise.all([
        prisma.service.create({
            data: {
                name: 'Business Consulting',
                description: 'Professional business consulting services',
                category: 'business',
                location: 'Nairobi',
                price: '5000/hour',
                availability: 'Available',
                experience: '10 years',
                providerId: users[1].id,
            },
        }),
        prisma.service.create({
            data: {
                name: 'Agricultural Training',
                description: 'Farm management training',
                category: 'agriculture',
                location: 'Nakuru',
                price: '2000/session',
                availability: 'Available',
                experience: '5 years',
                providerId: users[3].id,
            },
        }),
        prisma.service.create({
            data: {
                name: 'IT Support',
                description: 'Technical support services',
                category: 'technology',
                location: 'Eldoret',
                price: '3000/hour',
                availability: 'Available',
                experience: '8 years',
                providerId: users[4].id,
            },
        }),
    ]);
    console.log(`Created ${services.length} services`);
    const baseDate = new Date();
    baseDate.setHours(baseDate.getHours() - 24);
    const posts = [];
    for (let i = 0; i < 10; i++) {
        const createdAt = new Date(baseDate.getTime() + i * 30 * 60000);
        posts.push({
            data: {
                authorId: users[i % users.length].id,
                type: 'OPPORTUNITY',
                vertical: 'OPPORTUNITY',
                caption: `Job opportunity #${i + 1} in agriculture sector`,
                createdAt,
            },
        });
    }
    for (let i = 0; i < 10; i++) {
        const createdAt = new Date(baseDate.getTime() + (10 + i) * 30 * 60000);
        posts.push({
            data: {
                authorId: users[i % users.length].id,
                type: 'MARKETPLACE',
                vertical: 'AGRICULTURE',
                caption: `Farm produce for sale #${i + 1}`,
                productId: products[i % 6].id,
                createdAt,
            },
        });
    }
    for (let i = 0; i < 10; i++) {
        const createdAt = new Date(baseDate.getTime() + (20 + i) * 30 * 60000);
        posts.push({
            data: {
                authorId: users[i % users.length].id,
                type: 'GENERAL',
                vertical: i < 5 ? 'BUSINESS' : 'AGRICULTURE',
                caption: `General post #${i + 1}`,
                createdAt,
            },
        });
    }
    const sameTimestamp = new Date(baseDate.getTime() + 23 * 60 * 60000);
    for (let i = 0; i < 10; i++) {
        posts.push({
            data: {
                authorId: users[i % users.length].id,
                type: 'GENERAL',
                vertical: 'BUSINESS',
                caption: `Same timestamp post #${i + 1}`,
                createdAt: sameTimestamp,
            },
        });
    }
    const createdPosts = await Promise.all(posts.map((post) => prisma.post.create(post)));
    console.log(`Created ${createdPosts.length} posts`);
    console.log('Seed completed successfully');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map