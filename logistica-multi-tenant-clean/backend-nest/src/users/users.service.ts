import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRepository } from '../database/repositories/user.repository';
import * as bcrypt from 'bcrypt';
import { isStrongPassword } from '../utils/password';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByCompany(companyId: string) {
    return this.userRepository.findByCompany(companyId);
  }

  async findById(id: string) {
    return this.userRepository.findById(id);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findSuperAdmins() {
    return this.userRepository.findSuperAdmins();
  }

  async update(id: string, data: any) {
    const { password, ...userData } = data;
    if (password !== undefined) {
      if (!isStrongPassword(password)) {
        throw new BadRequestException('Password must be at least 8 characters and contain one uppercase letter and one number');
      }
      userData.password = await bcrypt.hash(password, 10);
    }
    return this.userRepository.update({ id }, userData);
  }
}
