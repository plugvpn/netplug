import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkKeys() {
  try {
    const server = await prisma.vPNServer.findUnique({
      where: { id: 'wireguard' }
    });

    console.log('WireGuard Server:');
    console.log('================');
    if (server) {
      console.log('ID:', server.id);
      console.log('Name:', server.name);
      console.log('Protocol:', server.protocol);
      console.log('Host:', server.host);
      console.log('Port:', server.port);
      console.log('Private Key:', server.privateKey ? `${server.privateKey.substring(0, 20)}...` : 'NULL');
      console.log('Public Key:', server.publicKey ? `${server.publicKey.substring(0, 20)}...` : 'NULL');
      console.log('Private Key exists:', !!server.privateKey);
      console.log('Public Key exists:', !!server.publicKey);
    } else {
      console.log('No WireGuard server found!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKeys();
