import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 RideClub backend is running on http://localhost:${process.env.PORT || 3000}`);
}

bootstrap();
