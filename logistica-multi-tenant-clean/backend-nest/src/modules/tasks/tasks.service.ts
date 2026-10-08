import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, UpdateTaskStatusDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { TaskStatsDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova tarefa
   */
  async create(
    createTaskDto: CreateTaskDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    // Verifica se SUPER_ADMIN está criando para uma company específica
    let companyId = userCompanyId;

    if (userRole === 'SUPER_ADMIN') {
      if (!createTaskDto.companyId) {
        throw new BadRequestException(
          'SUPER_ADMIN deve especificar o ID da company',
        );
      }
      companyId = createTaskDto.companyId;

      // Verifica se a company existe
      const companyExists = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!companyExists) {
        throw new NotFoundException('Company não encontrada');
      }
    }

    // Converte a date para ISO string
    const dueDate = new Date(createTaskDto.dueDate);

    // Cria a tarefa
    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: 'PENDING',
        priority: createTaskDto.priority,
        dueDate: dueDate,
        assignedTo: createTaskDto.assignedTo || null,
        companyId: companyId,
        createdById: userId,
      },
    });

    return task;
  }

  /**
   * Lista todas as tarefas com filtros opcionais
   */
  async findAll(
    filterDto: FilterTaskDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    const where: any = {};

    // SUPER_ADMIN pode ver todas as tarefas ou filter por company
    if (userRole === 'SUPER_ADMIN') {
      if (filterDto.companyId) {
        where.companyId = filterDto.companyId;
      }
    } else {
      // Outros usuários só veem tarefas da própria company
      where.companyId = userCompanyId;
    }

    // Aplica filtros adicionais
    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.priority) {
      where.priority = filterDto.priority;
    }

    if (filterDto.assignedTo) {
      where.assignedTo = {
        contains: filterDto.assignedTo,
        mode: 'insensitive',
      };
    }

    if (filterDto.dueDateBefore || filterDto.dueDateAfter) {
      where.dueDate = {};
      if (filterDto.dueDateBefore) {
        where.dueDate.lte = new Date(filterDto.dueDateBefore);
      }
      if (filterDto.dueDateAfter) {
        where.dueDate.gte = new Date(filterDto.dueDateAfter);
      }
    }

    if (filterDto.search) {
      where.OR = [
        { title: { contains: filterDto.search, mode: 'insensitive' } },
        { description: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    return tasks;
  }

  /**
   * Busca uma tarefa por ID
   */
  async findOne(
    id: string,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    // Verifica permissões
    if (userRole !== 'SUPER_ADMIN' && task.companyId !== userCompanyId) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta tarefa',
      );
    }

    return task;
  }

  /**
   * Atualiza uma tarefa
   */
  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    const updateData: any = {};

    if (updateTaskDto.title !== undefined) {
      updateData.title = updateTaskDto.title;
    }

    if (updateTaskDto.description !== undefined) {
      updateData.description = updateTaskDto.description;
    }

    if (updateTaskDto.priority !== undefined) {
      updateData.priority = updateTaskDto.priority;
    }

    if (updateTaskDto.status !== undefined) {
      updateData.status = updateTaskDto.status;
    }

    if (updateTaskDto.dueDate !== undefined) {
      updateData.dueDate = new Date(updateTaskDto.dueDate);
    }

    if (updateTaskDto.assignedTo !== undefined) {
      updateData.assignedTo = updateTaskDto.assignedTo || null;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateData,
    });

    return updatedTask;
  }

  /**
   * Atualiza apenas o status de uma tarefa
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateTaskStatusDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
      },
    });

    return updatedTask;
  }

  /**
   * Remove uma tarefa
   */
  async remove(
    id: string,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Tarefa excluída com success' };
  }

  /**
   * Obtém estatísticas das tarefas
   */
  async getStats(
    userId: string,
    userRole: string,
    userCompanyId: string,
    companyId?: string,
  ): Promise<TaskStatsDto> {
    const where: any = {};

    if (userRole === 'SUPER_ADMIN' && companyId) {
      where.companyId = companyId;
    } else if (userRole !== 'SUPER_ADMIN') {
      where.companyId = userCompanyId;
    }

    const [total, pending, inProgress, completed, cancelled, urgent, overdue] =
      await Promise.all([
        this.prisma.task.count({ where }),
        this.prisma.task.count({ where: { ...where, status: 'PENDING' } }),
        this.prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        this.prisma.task.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.task.count({ where: { ...where, status: 'CANCELLED' } }),
        this.prisma.task.count({ where: { ...where, priority: 'URGENT' } }),
        this.prisma.task.count({
          where: {
            ...where,
            dueDate: { lt: new Date() },
            status: { not: 'COMPLETED' },
          },
        }),
      ]);

    return {
      total,
      pending,
      inProgress,
      completed,
      cancelled,
      urgent,
      overdue,
    };
  }
}
