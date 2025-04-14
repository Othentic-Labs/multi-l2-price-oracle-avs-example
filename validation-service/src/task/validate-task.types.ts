export interface ValidateRequestDto {
    proofOfTask: string;
}

export interface ValidateResponseDto {
    data: boolean;
}

export interface ErrorResponseDto {
    data: boolean;
    message: string;
}
