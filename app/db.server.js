import PrismaPkg from "@prisma/client";
const { PrismaClient } = PrismaPkg;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;