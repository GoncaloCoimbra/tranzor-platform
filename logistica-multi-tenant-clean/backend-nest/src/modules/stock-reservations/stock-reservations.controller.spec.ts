import { Test, TestingModule } from '@nestjs/testing';
import { StockReservationsController } from './stock-reservations.controller';
import { StockReservationsService } from './stock-reservations.service';
import { StockReservationStatus } from '@prisma/client';
import { ListStockReservationsDto } from './dto/list-stock-reservations.dto';

describe('StockReservationsController', () => {
  let controller: StockReservationsController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockReservationsController],
      providers: [
        {
          provide: StockReservationsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<StockReservationsController>(
      StockReservationsController,
    );
  });

  it('lists reservations using the authenticated company and query filters', async () => {
    const query: ListStockReservationsDto = {
      page: 2,
      limit: 10,
      status: StockReservationStatus.RESERVED,
      productId: '11111111-1111-4111-8111-111111111111',
      transportId: '22222222-2222-4222-8222-222222222222',
    };
    const response = {
      data: [],
      total: 0,
      page: 2,
      limit: 10,
    };
    service.findAll.mockResolvedValue(response);

    await expect(
      controller.findAll({ companyId: 'company-a' }, query),
    ).resolves.toEqual(response);

    expect(service.findAll).toHaveBeenCalledWith('company-a', query);
  });

  it('loads a reservation using the authenticated company', async () => {
    const reservation = { id: 'reservation-a', companyId: 'company-a' };
    service.findOne.mockResolvedValue(reservation);

    await expect(
      controller.findOne('33333333-3333-4333-8333-333333333333', {
        companyId: 'company-a',
      }),
    ).resolves.toEqual(reservation);

    expect(service.findOne).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'company-a',
    );
  });
});
