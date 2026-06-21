import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ActivitiesModule } from "./activities/activities.module";
import { RegistrationsModule } from "./registrations/registrations.module";
import { CheckInsModule } from "./check-ins/check-ins.module";
import { PointsModule } from "./points/points.module";
import { ViolationsModule } from "./violations/violations.module";
import { StatisticsModule } from "./statistics/statistics.module";
import { GroupsModule } from "./groups/groups.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ActivitiesModule,
    RegistrationsModule,
    CheckInsModule,
    PointsModule,
    ViolationsModule,
    StatisticsModule,
    GroupsModule,
  ],
})
export class AppModule {}
