import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Prisma Client successfully imported and instantiated.');
    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
