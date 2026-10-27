import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Lets the app finish in-flight requests when ECS/EC2 sends SIGTERM
  app.enableShutdownHooks();
  // Bind to all interfaces so the app is reachable inside a container
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
