/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as securityNewDevice } from './security-new-device.tsx'
import { template as securityAccountLocked } from './security-account-locked.tsx'
import { template as schedulingConfirmation } from './scheduling-confirmation.tsx'
import { template as schedulingAdminNotification } from './scheduling-admin-notification.tsx'
import { template as schedulingApproved } from './scheduling-approved.tsx'
import { template as schedulingRejected } from './scheduling-rejected.tsx'
import { template as agendamentoNotificacao } from './agendamento-notificacao.tsx'
import { template as storageAlert } from './storage-alert.tsx'
import { template as deployNotification } from './deploy-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'security-new-device': securityNewDevice,
  'security-account-locked': securityAccountLocked,
  'scheduling-confirmation': schedulingConfirmation,
  'scheduling-admin-notification': schedulingAdminNotification,
  'scheduling-approved': schedulingApproved,
  'scheduling-rejected': schedulingRejected,
  'agendamento-notificacao': agendamentoNotificacao,
  'storage-alert': storageAlert,
  'deploy-notification': deployNotification,
}
