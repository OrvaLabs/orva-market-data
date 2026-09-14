import { Test, TestingModule } from '@nestjs/testing';
import { NormalizationService } from './normalization.service.js';

describe('NormalizationService', () => {
  let service: NormalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NormalizationService],
    }).compile();

    service = module.get<NormalizationService>(NormalizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
