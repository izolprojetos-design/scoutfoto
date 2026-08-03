/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'
const EDITOR_URL = 'https://lovable.dev/projects/ef806d68-a312-4bb7-aa7b-7d0bd0d87fda'
const SITE_URL = 'https://scoutfoto.lovable.app'

interface Props {
  commitMessage?: string
  commitUrl?: string
  authorName?: string
  branch?: string
}

const DeployNotificationEmail = ({
  commitMessage = '—',
  commitUrl = '#',
  authorName = '—',
  branch = 'main',
}: Props) => {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Nova versão do {SITE_NAME} aguarda publicação</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🚀 Nova versão aguarda publicação</Heading>

          <Text style={text}>
            Houve um push na branch <strong>{branch}</strong> do repositório do {SITE_NAME}.
            O código já foi sincronizado com o editor da Lovable, mas ainda é necessário
            publicar a versão para que ela fique disponível no site.
          </Text>

          <Section style={detailsBox}>
            <Text style={detailLabel}>Autor</Text>
            <Text style={detailValue}>{authorName}</Text>

            <Text style={detailLabel}>Commit</Text>
            <Text style={detailValue}>{commitMessage}</Text>
          </Section>

          <Text style={text}>
            Clique no botão abaixo para abrir o editor da Lovable e depois em
            <strong> Publish → Update</strong> para aplicar a nova versão.
          </Text>

          <Button style={button} href={EDITOR_URL}>
            Abrir editor da Lovable
          </Button>

          <Text style={text}>
            Ou visualize o site publicado atualmente:
          </Text>

          <Button style={{ ...button, backgroundColor: '#606B73' }} href={SITE_URL}>
            Ver site publicado
          </Button>

          <Text style={footer}>
            Notificação automática do {SITE_NAME}. Você recebe este e-mail porque está
            configurado para receber alertas de deploy.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DeployNotificationEmail,
  subject: `🚀 Nova versão do ScoutFoto aguarda publicação`,
  displayName: 'Notificação de deploy',
  previewData: {
    commitMessage: 'Atualiza página inicial',
    commitUrl: 'https://github.com/izolprojetos-design/scoutfoto/commit/abc123',
    authorName: 'Equipe ScoutFoto',
    branch: 'main',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 'bold' as const, color: '#191F25', margin: '0 0 16px', letterSpacing: '-0.02em' }
const text = { fontSize: '14px', color: '#606B73', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = { backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px 20px', marginBottom: '20px' }
const detailLabel = { fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px', fontWeight: '600' as const }
const detailValue = { fontSize: '14px', color: '#191F25', margin: '0 0 12px', fontWeight: '500' as const }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
