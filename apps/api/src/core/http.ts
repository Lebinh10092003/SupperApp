import type {Request,Response,NextFunction} from 'express';
export class HttpError extends Error{constructor(public status:number,message:string,public code='HTTP_ERROR',public details?:unknown){super(message)}}
export const asyncRoute=(fn:(req:Request,res:Response,next:NextFunction)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res,next)).catch(next)};
export function errorHandler(err:unknown,_req:Request,res:Response,_next:NextFunction){const e=err instanceof HttpError?err:new HttpError(500,err instanceof Error?err.message:'Lỗi không xác định','INTERNAL_ERROR');res.status(e.status).json({error:{code:e.code,message:e.message,details:e.details??null}})}
