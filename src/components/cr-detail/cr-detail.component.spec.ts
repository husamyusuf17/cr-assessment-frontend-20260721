import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [
			{
				provide: SessionService,
				useValue: { user },
			},
		],
	});

	await TestBed.compileComponents();

	const fixture = TestBed.createComponent(CrDetailComponent);

	fixture.componentInstance.id = id;

	fixture.detectChanges(); // ngOnInit -> load()

	await flush(); // let the mock API resolve

	fixture.detectChanges(); // render the loaded state

	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');

		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1');

		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		expect(approveBtn.disabled).toBe(true);
	});

	it('renders the approval timeline chronologically', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const entries = fixture.nativeElement.querySelectorAll('.cr-timeline__entry');

		expect(entries[0].textContent).toContain('CREATE');
		expect(entries[1].textContent).toContain('SUBMIT');
		expect(entries[2].textContent).toContain('SEND_FOR_APPROVAL');
	});

	it('hides Reject for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1');

		const rejectSection = fixture.nativeElement.querySelector('.cr-actions__reject');

		expect(rejectSection).toBeNull();
	});

	it('does not allow actions when the CR is not pending approval', async () => {
		const fixture = await render(users.approver, 'CR-2');

		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		const rejectSection = fixture.nativeElement.querySelector('.cr-actions__reject');

		expect(approveBtn.disabled).toBe(true);
		expect(rejectSection).toBeNull();
	});

	it('requires a non-whitespace reason before Reject is enabled', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');

		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');

		expect(rejectBtn.disabled).toBe(true);

		reason.value = '   ';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		expect(rejectBtn.disabled).toBe(true);

		reason.value = 'Incorrect pricing';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		expect(rejectBtn.disabled).toBe(false);
	});

	it('approves a pending CR and updates the rendered status', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		approveBtn.click();

		await flush();
		fixture.detectChanges();

		const status = fixture.nativeElement.querySelector('.cr-status');

		expect(status.textContent).toContain('APPROVED');
		expect(approveBtn.disabled).toBe(true);
	});

	it('rejects a pending CR and updates the rendered status', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');

		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');

		reason.value = 'Incorrect pricing';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		rejectBtn.click();

		await flush();
		fixture.detectChanges();

		const status = fixture.nativeElement.querySelector('.cr-status');

		expect(status.textContent).toContain('REJECTED');
	});

	it('prevents duplicate Approve submissions while the request is pending', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const api = TestBed.inject(CrApiService);
		api.latencyMs = 50;

		const approveSpy = jest.spyOn(api, 'approve');

		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		approveBtn.click();

		fixture.detectChanges();

		expect(approveBtn.disabled).toBe(true);

		approveBtn.click();

		expect(approveSpy).toHaveBeenCalledTimes(1);

		await new Promise((r) => setTimeout(r, 60));
		fixture.detectChanges();
	});

	it('shows an error and keeps the CR unchanged when Approve fails', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		approveBtn.click();

		await flush();
		fixture.detectChanges();

		const error = fixture.nativeElement.querySelector('.cr-actions__error');

		const status = fixture.nativeElement.querySelector('.cr-status');

		expect(error.textContent).toContain('Network error');
		expect(status.textContent).toContain('PENDING_APPROVAL');
		expect(approveBtn.disabled).toBe(false);
	});

	it('shows an error and keeps the CR unchanged when Reject fails', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');

		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');

		reason.value = 'Incorrect pricing';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		rejectBtn.click();

		await flush();
		fixture.detectChanges();

		const error = fixture.nativeElement.querySelector('.cr-actions__error');

		const status = fixture.nativeElement.querySelector('.cr-status');

		expect(error.textContent).toContain('Network error');
		expect(status.textContent).toContain('PENDING_APPROVAL');
		expect(rejectBtn.disabled).toBe(false);
	});

	it('renders the baseline total, new total, and delta', async () => {
		const fixture = await render(users.approver, 'CR-1');

		const totals = fixture.nativeElement.querySelector('.cr-detail__totals');

		expect(totals.textContent).toContain('USD 8,000.00');
		expect(totals.textContent).toContain('USD 8,500.00');
		expect(totals.textContent).toContain('USD 500.00');
	});
	it('renders description changes in the diff preview', async () => {
		const fixture = await render(users.approver, 'CR-2');

		const changedRow = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');

		expect(changedRow).not.toBeNull();
		expect(changedRow.textContent).toContain('Widget B');
		expect(changedRow.textContent).toContain('Widget B (new supplier)');
	});
});
