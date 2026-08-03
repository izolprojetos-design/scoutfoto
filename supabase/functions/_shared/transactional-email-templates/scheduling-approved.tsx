/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'

interface Props {
  nomeResponsavel?: string
  data?: string
  horario?: string
  local?: string
  tipo?: string
  ramo?: string
  assunto?: string
}

const SchedulingApprovedEmail = ({
  nomeResponsavel,
  data,
  horario,
  local,
  tipo,
  ramo,
  assunto,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua solicitação de agendamento foi aprovada!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {nomeResponsavel ? `Parabéns, ${nomeResponsavel}!` : 'Parabéns!'}
        </Heading>
        <Text style={text}>
          Sua solicitação de agendamento foi <strong style={{ color: '#2B6E3F' }}>aprovada</strong> pela coordenação do <strong>{SITE_NAME}</strong>.
          O evento já foi adicionado ao Calendário Escoteiro.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Detalhes do evento</Heading>
          {data && <Text style={detail}><strong>Data:</strong> {data}</Text>}
          {horario && <Text style={detail}><strong>Horário:</strong> {horario}</Text>}
          {local && <Text style={detail}><strong>Local:</strong> {local}</Text>}
          {ramo && <Text style={detail}><strong>Ramo:</strong> {ramo}</Text>}
          {tipo && <Text style={detail}><strong>Tipo:</strong> {tipo}</Text>}
          {assunto && <Text style={detail}><strong>Assunto:</strong> {assunto}</Text>}
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Atenciosamente,<br />
          Equipe {SITE_NAME} — 12º Grupo Escoteiro Monte Caburaí
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SchedulingApprovedEmail,
  subject: 'Sua solicitação de agendamento foi aprovada — ScoutFoto',
  displayName: 'Agendamento Aprovado',
  previewData: {
    nomeResponsavel: 'Maria Silva',
    data: '15/05/2026',
    horario: '14:00',
    local: 'Sede do Grupo',
    tipo: 'Reunião',
    ramo: '🐺 Lobinho',
    assunto: 'Reunião ordinária da Alcateia.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 'bold' as const, color: '#191F25', margin: '0 0 20px', letterSpacing: '-0.02em' }
const h2 = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '16px', fontWeight: '600' as const, color: '#191F25', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#606B73', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#F6F3ED', borderRadius: '12px', padding: '16px 20px', margin: '16px 0 24px', border: '1px solid #E5E0D5' }
const detail = { fontSize: '13px', color: '#191F25', margin: '4px 0', lineHeight: '1.5' }
const hr = { borderColor: '#E5E0D5', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0', lineHeight: '1.5' }
