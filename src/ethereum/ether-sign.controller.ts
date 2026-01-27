import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { EtherSignService } from './services/ether-sign.service';
import { Response } from 'express';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { JwtService } from '@nestjs/jwt';
import { Public } from './guards/public.decorator';

@Controller('ether-sign')
export class EtherSignController {
  constructor(
    private readonly etherSignService: EtherSignService,
    private jwtService: JwtService,
  ) {}

  @Public()
  @Post('sign')
  async userSign(
    @Body('address') address: string,
    @Res() res: Response,
  ): Promise<any> {
    const user = await this.etherSignService.findOne(address);
    if (!user) {
      // If the user does not exist, create a new user with a nonce
      const nonce = await this.etherSignService.create(address);
      res.status(HttpStatus.OK).send({ nonce: nonce });
      return;
    }
    res.status(HttpStatus.OK).send({ nonce: user.nonce });
  }

  @Public()
  @Post('verify')
  async verifySignature(
    @Body('address') address: string,
    @Body('signature') signature: string,
    @Res() res: Response,
  ): Promise<any> {
    const user = await this.etherSignService.findOne(address);
    if (!user) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send('User not found. Please sign in first.');
      return;
    }

    const existingNonce = user.nonce;
    // Recover the address of the account used to create the given Ethereum signature.
    const recoveredAddress = recoverPersonalSignature({
      data: `0x${this.etherSignService.toHex(existingNonce)}`,
      signature: signature,
    });
    // See if that matches the address the user is claiming the signature is from
    if (recoveredAddress === address) {
      // The signature was verified - update the nonce to prevent replay attacks
      // update nonce
      await this.etherSignService.updateNonce(address);

      const access_token = await this.jwtService.signAsync({
        address: address,
      });

      // Return the token
      return res.status(HttpStatus.OK).send({
        access_token: access_token,
      });
    } else {
      // The signature could not be verified
      return res.sendStatus(401);
    }

    // Here you would typically verify the signature against the user's nonce
    // For simplicity, let's assume the signature is valid if it matches the nonce
    // if (signature === user.nonce.toString()) {
  }
}
