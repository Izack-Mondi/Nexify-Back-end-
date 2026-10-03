"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const AGRICULTURE_CATEGORIES = [
    'crops',
    'livestock',
    'dairy',
    'produce',
    'poultry',
    'fish',
    'farm inputs',
    'seeds',
    'fertilizers',
    'pesticides',
    'farm machinery',
    'agricultural equipment',
    'vegetables',
    'fruits',
    'grains',
    'cereals',
    'agriculture',
    'farming',
];
function assignVertical(type, productCategory) {
    if (type === 'OPPORTUNITY') {
        return 'OPPORTUNITY';
    }
    if (productCategory) {
        const normalizedCategory = productCategory.toLowerCase();
        const isAgriculture = AGRICULTURE_CATEGORIES.some((cat) => normalizedCategory.includes(cat.toLowerCase()));
        return isAgriculture ? 'AGRICULTURE' : 'BUSINESS';
    }
    return 'BUSINESS';
}
async function backfillVerticals() {
    const prisma = new client_1.PrismaClient();
    try {
        console.log('Starting vertical backfill...');
        const posts = await prisma.post.findMany({
            include: {
                product: {
                    select: {
                        category: true,
                    },
                },
            },
        });
        console.log(`Found ${posts.length} posts to backfill`);
        for (const post of posts) {
            const vertical = assignVertical(post.type, post.product?.category);
            await prisma.post.update({
                where: { id: post.id },
                data: { vertical: vertical },
            });
            console.log(`Updated post ${post.id} (${post.type}) -> ${vertical}`);
        }
        console.log('Backfill completed successfully');
    }
    catch (error) {
        console.error('Backfill failed:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
backfillVerticals();
//# sourceMappingURL=backfill.js.map