import { Test, TestingModule } from '@nestjs/testing';
import { SpreadService } from './spread.service.js';

describe('SpreadService', () => {
  let service: SpreadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpreadService],
    }).compile();

    service = module.get<SpreadService>(SpreadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
