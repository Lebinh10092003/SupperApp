import type {Request,Response,NextFunction} from 'express';
export class HttpError extends Error{constructor(public status:number,message:string,public code='HTTP_ERROR',public details?:unknown){super(message)}}
export const asyncRoute=(fn:(req:Request,res:Response,next:NextFunction)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res,next)).catch(next)};
// `HttpError` là lỗi nghiệp vụ đã được cố ý gắn message tiếng Việt an toàn để
// hiển thị cho người dùng (VD wrapAppError ở safety.routes.ts) — hiển thị
// nguyên văn. Mọi lỗi KHÁC (exception thật từ DB driver/ORM, bug code...) là
// lỗi KHÔNG lường trước — driver Postgres/drizzle-orm thường nhét nguyên văn
// câu SQL + params vào `Error.message` (VD "Failed query: insert into ...
// params: ..."), lộ cấu trúc bảng/cột nội bộ nếu trả thẳng ra client, kể cả
// cho route công khai không đăng nhập (submitReport, lookupReportStatus...).
// Vì vậy: log ĐẦY ĐỦ (message + stack) ở server để còn điều tra được, nhưng
// CHỈ trả thông báo chung chung ra client.
export function errorHandler(err:unknown,req:Request,res:Response,_next:NextFunction){
  if(err instanceof HttpError){
    res.status(err.status).json({error:{code:err.code,message:err.message,details:err.details??null}});
    return;
  }
  console.error(`[errorHandler] Lỗi không lường trước tại ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Có lỗi xảy ra, vui lòng thử lại sau.',details:null}});
}
