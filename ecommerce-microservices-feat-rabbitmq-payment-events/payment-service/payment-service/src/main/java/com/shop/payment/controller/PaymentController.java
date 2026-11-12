package com.shop.payment.controller;

import com.shop.payment.dto.CreatePaymentRequest;
import com.shop.payment.dto.PaymentResponse;
import com.shop.payment.dto.UpdatePaymentStatusRequest;
import com.shop.payment.enums.PaymentStatus;
import com.shop.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

@RestController
@RequestMapping("/api/payments")
@Validated
@Tag(name = "Paiements", description = "Gestion des paiements simulés")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('user', 'admin')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Créer une tentative de paiement",
            description = "Le montant et la devise proviennent de order-service, jamais du client. "
                    + "La clé d'idempotence rend les répétitions sûres.")
    @ApiResponse(responseCode = "201", description = "Paiement créé ou tentative identique rejouée",
            content = @Content(schema = @Schema(implementation = PaymentResponse.class),
                    examples = @ExampleObject(value = """
                            {"id":"65a1b2c3d4e5f60718293a4b","orderId":1001,"amount":49.99,"currency":"TND",
                             "method":"SIMULATED_CARD","status":"SUCCEEDED",
                             "createdAt":"2026-01-01T10:00:00Z","updatedAt":"2026-01-01T10:00:00Z"}
                            """)))
    @ApiResponse(responseCode = "400", description = "Requête invalide")
    @ApiResponse(responseCode = "404", description = "Commande inexistante")
    @ApiResponse(responseCode = "409", description = "Clé d'idempotence en conflit")
    @ApiResponse(responseCode = "409", description = "Le statut de la commande ne permet pas le paiement")
    @ApiResponse(responseCode = "503", description = "order-service indisponible")
    public PaymentResponse create(
            @Valid
            @RequestBody(description = "Données de la tentative ; le montant est résolu depuis order-service",
                    required = true, content = @Content(examples = @ExampleObject(value = """
                            {"orderId":1001,"method":"SIMULATED_CARD","idempotencyKey":"demo-order-1001"}
                            """)))
            @org.springframework.web.bind.annotation.RequestBody CreatePaymentRequest request) {
        return paymentService.create(request);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('user', 'admin')")
    @Operation(summary = "Lister les paiements",
            description = "Filtre optionnel par orderId et status. Pagination indexée à partir de zéro.")
    @ApiResponse(responseCode = "200", description = "Page de paiements")
    @ApiResponse(responseCode = "400", description = "Paramètre de pagination ou filtre invalide")
    public Page<PaymentResponse> findAll(
            @Parameter(description = "Identifiant de commande") @RequestParam(required = false) @Positive Long orderId,
            @Parameter(description = "Statut du paiement") @RequestParam(required = false) PaymentStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return paymentService.findAll(orderId, status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('user', 'admin')")
    @Operation(summary = "Consulter un paiement")
    @ApiResponse(responseCode = "200", description = "Paiement trouvé")
    @ApiResponse(responseCode = "400", description = "Identifiant MongoDB invalide")
    @ApiResponse(responseCode = "404", description = "Paiement inexistant")
    public PaymentResponse findById(@PathVariable @Pattern(regexp = "[a-fA-F0-9]{24}") String id) {
        return paymentService.findById(id);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('admin')")
    @Operation(summary = "Finaliser un paiement en attente",
            description = "Opération de démonstration réservée au contexte de développement. "
                    + "Avant toute exposition, la protéger par une autorisation adaptée. "
                    + "Seule une transition PENDING vers SUCCEEDED ou FAILED est permise.")
    @ApiResponse(responseCode = "200", description = "Statut mis à jour")
    @ApiResponse(responseCode = "400", description = "Corps ou statut invalide")
    @ApiResponse(responseCode = "404", description = "Paiement inexistant")
    @ApiResponse(responseCode = "409", description = "Transition interdite ou paiement déjà finalisé")
    public PaymentResponse updateStatus(
            @PathVariable @Pattern(regexp = "[a-fA-F0-9]{24}") String id,
            @Valid
            @RequestBody(description = "Statut terminal à appliquer à un paiement en attente",
                    required = true, content = @Content(examples = @ExampleObject(value = """
                            {"status":"SUCCEEDED"}
                            """)))
            @org.springframework.web.bind.annotation.RequestBody UpdatePaymentStatusRequest request
    ) {
        return paymentService.updateStatus(id, request.status());
    }
}
