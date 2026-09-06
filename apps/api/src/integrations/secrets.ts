import {SecretManagerServiceClient} from '@google-cloud/secret-manager';import {env} from '../config/env.js';const client=new SecretManagerServiceClient();const name=(s:string)=>`projects/${env.PROJECT_ID}/secrets/${s}`;
export async function readSecret(s:string){const [v]=await client.accessSecretVersion({name:`${name(s)}/versions/latest`});return v.payload?.data?.toString()||''}
export async function writeSecret(s:string,value:string){await client.addSecretVersion({parent:name(s),payload:{data:Buffer.from(value)}})}
