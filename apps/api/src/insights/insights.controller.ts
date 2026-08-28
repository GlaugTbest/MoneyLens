import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { MonthQueryDto, PeriodQueryDto, SpendEvolutionQueryDto } from './dto/period-query.dto';

@ApiTags('insights')
@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('spend-evolution')
  spendEvolution(@CurrentUser() user: CurrentUserPayload, @Query() query: SpendEvolutionQueryDto) {
    return this.insights.getSpendEvolution(
      user.userId,
      query.groupBy,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('top-categories')
  topCategories(@CurrentUser() user: CurrentUserPayload, @Query() query: PeriodQueryDto) {
    return this.insights.getTopCategories(
      user.userId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('concentration')
  concentration(@CurrentUser() user: CurrentUserPayload, @Query() query: PeriodQueryDto) {
    return this.insights.getConcentration(
      user.userId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('recurring')
  recurring(@CurrentUser() user: CurrentUserPayload) {
    return this.insights.getRecurring(user.userId);
  }

  @Get('anomalies')
  anomalies(@CurrentUser() user: CurrentUserPayload, @Query() query: MonthQueryDto) {
    return this.insights.getAnomalies(user.userId, query.month ? new Date(query.month) : undefined);
  }

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserPayload) {
    return this.insights.getSummary(user.userId);
  }

  // Usado pela página /insights: consolida tudo que a tela precisa em uma
  // única chamada, em vez de 5 round-trips separados do frontend.
  @Get('report')
  report(@CurrentUser() user: CurrentUserPayload) {
    return this.insights.getFullReport(user.userId);
  }
}
