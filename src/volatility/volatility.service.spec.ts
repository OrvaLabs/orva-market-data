import { Test, TestingModule } from '@nestjs/testing';
import { VolatilityService } from './volatility.service.js';

describe('VolatilityService', () => {
  let service: VolatilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VolatilityService],
    }).compile();

    service = module.get<VolatilityService>(VolatilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
