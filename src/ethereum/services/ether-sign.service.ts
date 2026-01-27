import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/users.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class EtherSignService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {}

  async findOne(address: string): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({
      where: { address: address },
    });
    return user;
  }

  async create(address: string): Promise<string> {
    const nonce = this.generateNonce();
    const user = this.userRepository.create({
      address: address,
      nonce: nonce,
    });
    await this.userRepository.save(user);
    return nonce;
  }

  async updateNonce(address: string): Promise<void> {
    await this.userRepository.update(
      { address: address },
      { nonce: this.generateNonce() },
    );
  }

  toHex(stringToConvert: string): string {
    return stringToConvert
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  }

  async signIn(address: string): Promise<{ access_token: string }> {
    const payload = { address: address };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  private generateNonce(): string {
    return Math.floor(Math.random() * 1000000).toString(); // Generate a random nonce
  }
}
