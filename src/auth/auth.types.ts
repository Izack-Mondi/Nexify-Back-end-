import { Field, ObjectType, InputType, ID, registerEnumType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  fullName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phoneNumber: string;

  @Field({ nullable: true })
  country: string;

  @Field({ nullable: true })
  location: string;

  @Field(() => [String])
  interests: string[];

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  emailVerified: boolean;

  @Field({ nullable: true })
  phoneVerified: boolean;
}

@ObjectType()
export class AuthPayload {
  @Field({ nullable: true })
  accessToken: string;

  @Field({ nullable: true })
  refreshToken: string;

  @Field()
  verificationRequired: boolean;

  @Field({ nullable: true })
  message: string;

  @Field(() => User)
  user: User;
}

@InputType()
export class RegisterInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @Field({ nullable: true })
  @IsString()
  verificationMethod?: string;
}

@InputType()
export class VerifyRegistrationInput {
  @Field()
  @IsNotEmpty()
  userId: string;

  @Field()
  @IsNotEmpty()
  code: string;
}

@InputType()
export class ResendVerificationCodeInput {
  @Field({ nullable: true })
  userId: string;

  @Field({ nullable: true })
  email: string;

  @Field({ nullable: true })
  @IsString()
  verificationMethod?: string;
}

@InputType()
export class CompletePasswordSetupInput {
  @Field()
  @IsNotEmpty()
  userId: string;

  @Field()
  @MinLength(8)
  password: string;
}

@InputType()
export class CompleteProfileInput {
  @Field()
  @IsNotEmpty()
  userId: string;

  @Field()
  @IsNotEmpty()
  fullName: string;

  @Field({ nullable: true })
  country: string;

  @Field({ nullable: true })
  location: string;

  @Field(() => [String])
  interests: string[];
}

@InputType()
export class LoginInput {
  @Field()
  @IsNotEmpty()
  identifier: string;

  @Field()
  @IsNotEmpty()
  password: string;
}

@InputType()
export class RefreshSessionInput {
  @Field()
  refreshToken: string;
}

@InputType()
export class LogoutInput {
  @Field()
  refreshToken: string;
}
